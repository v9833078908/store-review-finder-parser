from __future__ import annotations

import asyncio
import inspect
import uuid
from typing import Any, Awaitable, Callable

from observability import observe, update_current_span, update_current_trace

from alerts import Alert, detect_alerts
from analyzer import run_theme_extraction
from classifier import run_classification
from config import SHARED_PIPELINE_CONCURRENCY
from llm import call_llm, get_model_for_task
from report_layers import build_report_layers
from utils import (
    build_category_counts,
    load_prompt,
    log_event,
    prompt_version,
    review_stats,
    to_json,
)

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


@observe(name="run_unified_pipeline", capture_input=False, capture_output=False)
async def run_unified_pipeline(
    reviews: list[dict[str, Any]],
    app_name: str,
    changelog: str = "",
    known_issues: list[str] | None = None,
    current_version: dict[str, Any] | None = None,
    previous_version: dict[str, Any] | None = None,
    semaphore_size: int = SHARED_PIPELINE_CONCURRENCY,
    progress_callback: PipelineProgressCallback | None = None,
) -> dict[str, Any]:
    run_id = uuid.uuid4().hex[:12]
    known_issues = known_issues or []
    loop = asyncio.get_running_loop()
    started_at = loop.time()
    synthesis_model = get_model_for_task("synthesis")

    update_current_trace(
        name="unified_pipeline",
        session_id=run_id,
        metadata={
            "run_id": run_id,
            "app_name": app_name,
            "reviews_total": len(reviews),
            "model": synthesis_model,
        },
        tags=["pipeline", "reviews"],
    )

    async def _emit(event: PipelineEvent) -> None:
        log_event("pipeline_event", run_id=run_id, **event)
        if not progress_callback:
            return
        maybe_awaitable = progress_callback(event)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

    log_event(
        "pipeline_started",
        run_id=run_id,
        app_name=app_name,
        reviews_total=len(reviews),
        model=synthesis_model,
        semaphore_size=semaphore_size,
    )
    update_current_span(
        metadata={
            "run_id": run_id,
            "app_name": app_name,
            "reviews_total": len(reviews),
            "semaphore_size": semaphore_size,
        }
    )

    if not reviews:
        return {
            "run_id": run_id,
            "themes": [],
            "classified": [],
            "alerts": [],
            "stats": review_stats(reviews),
            "category_counts": {},
            "synthesis_markdown": "",
            "report_layers": build_report_layers(
                app_name=app_name,
                stats=review_stats(reviews),
                reviews=reviews,
                themes=[],
                alerts=[],
                category_counts={},
            ),
            "model": synthesis_model,
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
            reviews=reviews,
            semaphore=semaphore,
            progress_callback=_themes_progress,
        )
    )
    classify_task = asyncio.create_task(
        run_classification(
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
    synthesis_markdown = await call_llm(synthesis_prompt, task="synthesis", max_tokens=2200)

    report_layers = build_report_layers(
        app_name=app_name,
        stats=stats,
        reviews=reviews,
        themes=themes,
        alerts=alerts,
        category_counts=category_counts,
    )

    await _emit({"type": "status", "step": "analyzed"})
    duration_ms = round((loop.time() - started_at) * 1000)
    log_event(
        "pipeline_completed",
        run_id=run_id,
        app_name=app_name,
        reviews_total=len(reviews),
        alerts_total=len(alerts),
        themes_total=len(themes),
        duration_ms=duration_ms,
    )
    update_current_trace(
        session_id=run_id,
        metadata={
            "run_id": run_id,
            "alerts_total": len(alerts),
            "themes_total": len(themes),
            "reviews_total": len(reviews),
            "duration_ms": duration_ms,
        },
    )

    return {
        "run_id": run_id,
        "themes": themes,
        "classified": classified,
        "alerts": alerts,
        "stats": stats,
        "category_counts": category_counts,
        "synthesis_markdown": synthesis_markdown.strip(),
        "report_layers": report_layers,
        "model": synthesis_model,
        "prompt_versions": {
            "analyze_batch": prompt_version("analyze_batch.txt"),
            "classify_batch": prompt_version("classify_batch.txt"),
            "unified_report": prompt_version("unified_report.txt"),
        },
    }
