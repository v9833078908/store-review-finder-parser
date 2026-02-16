from __future__ import annotations

import asyncio
import inspect
import os
import uuid
from typing import Any, Awaitable, Callable

from anthropic import AsyncAnthropic

from alerts import Alert, detect_alerts
from analyzer import run_theme_extraction
from classifier import run_classification
from utils import (
    DEFAULT_MODEL,
    build_category_counts,
    call_model,
    get_client_and_model,
    load_prompt,
    prompt_version,
    review_stats,
    to_json,
)

SHARED_MAX_CONCURRENCY = 6

PipelineEvent = dict[str, Any]
PipelineProgressCallback = Callable[[PipelineEvent], Awaitable[None] | None]


def _alerts_to_json(alerts: list[Alert]) -> list[dict[str, Any]]:
    return [
        {
            "type": alert.type,
            "subcategory": alert.subcategory,
            "count": alert.count,
            "baseline": alert.baseline,
            "details": alert.details,
        }
        for alert in alerts
    ]


async def run_unified_pipeline(
    reviews: list[dict[str, Any]],
    app_name: str,
    changelog: str = "",
    known_issues: list[str] | None = None,
    current_version: dict[str, Any] | None = None,
    previous_version: dict[str, Any] | None = None,
    client: AsyncAnthropic | None = None,
    model: str | None = None,
    semaphore_size: int = SHARED_MAX_CONCURRENCY,
    progress_callback: PipelineProgressCallback | None = None,
) -> dict[str, Any]:
    run_id = uuid.uuid4().hex[:12]
    known_issues = known_issues or []

    async def _emit(event: PipelineEvent) -> None:
        if not progress_callback:
            return
        maybe_awaitable = progress_callback(event)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

    if client is None:
        client, resolved_model = get_client_and_model()
    else:
        resolved_model = model or (os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL)
    if model:
        resolved_model = model

    if not reviews:
        return {
            "run_id": run_id,
            "themes": [],
            "classified": [],
            "alerts": [],
            "stats": review_stats(reviews),
            "category_counts": {},
            "synthesis_markdown": "",
            "model": resolved_model,
            "prompt_versions": {
                "analyze_batch": prompt_version("analyze_batch.txt"),
                "classify_batch": prompt_version("classify_batch.txt"),
                "unified_report": prompt_version("unified_report.txt"),
            },
        }

    await _emit({"type": "status", "step": "analyzing"})

    semaphore = asyncio.Semaphore(semaphore_size)

    async def _themes_progress(current: int, total: int) -> None:
        await _emit({"type": "progress", "pipeline": "themes", "current": current, "total": total})

    async def _classify_progress(current: int, total: int) -> None:
        await _emit({"type": "progress", "pipeline": "classify", "current": current, "total": total})

    themes_task = asyncio.create_task(
        run_theme_extraction(
            client=client,
            model=resolved_model,
            reviews=reviews,
            semaphore=semaphore,
            progress_callback=_themes_progress,
        )
    )
    classify_task = asyncio.create_task(
        run_classification(
            client=client,
            model=resolved_model,
            reviews=reviews,
            changelog=changelog,
            known_issues=known_issues,
            semaphore=semaphore,
            progress_callback=_classify_progress,
        )
    )

    themes, classified = await asyncio.gather(themes_task, classify_task)

    await _emit({"type": "status", "step": "detecting_alerts"})
    alerts = detect_alerts(reviews, classified, current_version, previous_version)
    stats = review_stats(reviews)
    category_counts = build_category_counts(classified)

    await _emit({"type": "status", "step": "synthesizing"})
    prompt_template = load_prompt("unified_report.txt")
    synthesis_prompt = (
        prompt_template.replace("{{APP_NAME}}", app_name)
        .replace("{{CURRENT_VERSION}}", current_version.get("version", "unknown") if current_version else "unknown")
        .replace("{{PREVIOUS_VERSION}}", previous_version.get("version", "unknown") if previous_version else "unknown")
        .replace("{{CHANGELOG}}", changelog or "No changelog available")
        .replace("{{STATS_JSON}}", to_json(stats))
        .replace("{{CATEGORY_COUNTS_JSON}}", to_json(category_counts))
        .replace("{{THEMES_JSON}}", to_json(themes[:20]))
        .replace("{{ALERTS_JSON}}", to_json(_alerts_to_json(alerts)))
    )
    synthesis_markdown = await call_model(
        client=client,
        model=resolved_model,
        prompt=synthesis_prompt,
        max_tokens=2200,
    )

    await _emit({"type": "status", "step": "analyzed"})

    return {
        "run_id": run_id,
        "themes": themes,
        "classified": classified,
        "alerts": alerts,
        "stats": stats,
        "category_counts": category_counts,
        "synthesis_markdown": synthesis_markdown.strip(),
        "model": resolved_model,
        "prompt_versions": {
            "analyze_batch": prompt_version("analyze_batch.txt"),
            "classify_batch": prompt_version("classify_batch.txt"),
            "unified_report": prompt_version("unified_report.txt"),
        },
    }
