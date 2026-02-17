from __future__ import annotations

import asyncio
import json
from typing import Any, Awaitable, Callable

from anthropic import AsyncAnthropic

from utils import (
    call_model,
    chunked,
    compact_review,
    extract_json_text,
    get_client_and_model,
    load_prompt,
    to_json,
)

DEFAULT_BATCH_SIZE = 30
MAX_BATCH_CONCURRENCY = 4

ProgressCallback = Callable[[int, int], Awaitable[None] | None]


def _normalize_classification(raw: dict[str, Any]) -> dict[str, Any]:
    valid_categories = {"new_bug", "known_issue", "feature_request", "praise", "noise"}
    category = str(raw.get("category", "noise")).strip().lower()
    if category not in valid_categories:
        category = "noise"

    subcategory = str(raw.get("subcategory", "other")).strip().lower() or "other"

    device_mention = raw.get("device_mention")
    if device_mention and isinstance(device_mention, str):
        device_mention = device_mention.strip() or None
    else:
        device_mention = None

    try:
        confidence = float(raw.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
    except Exception:
        confidence = 0.5

    summary = str(raw.get("summary", "")).strip()

    return {
        "review_id": str(raw.get("review_id", "")),
        "category": category,
        "subcategory": subcategory,
        "device_mention": device_mention,
        "confidence": confidence,
        "summary": summary,
    }


def _default_classification(review_id: str) -> dict[str, Any]:
    return {
        "review_id": review_id,
        "category": "noise",
        "subcategory": "general",
        "device_mention": None,
        "confidence": 0.0,
        "summary": "",
    }


async def _classify_batch(
    client: AsyncAnthropic,
    model: str,
    batch: list[dict[str, Any]],
    prompt_template: str,
    changelog: str,
    known_issues: list[str],
) -> list[dict[str, Any]]:
    compact_batch = [compact_review(review, max_text=800) for review in batch]

    known_issues_text = "\n".join(f"- {issue}" for issue in known_issues) if known_issues else "None"
    prompt = (
        prompt_template.replace("{{CHANGELOG}}", changelog or "No changelog available")
        .replace("{{KNOWN_ISSUES}}", known_issues_text)
        .replace("{{REVIEWS_JSON}}", to_json(compact_batch))
    )

    raw = await call_model(client, model, prompt, max_tokens=4000, prompt_name="classify_batch")
    parsed = json.loads(extract_json_text(raw))

    if not isinstance(parsed, list):
        raise ValueError("Model returned unexpected payload for classification.")

    normalized = [_normalize_classification(item) for item in parsed if isinstance(item, dict)]

    # Ensure one classification entry per input review.
    normalized_by_id = {item["review_id"]: item for item in normalized if item.get("review_id")}
    ordered: list[dict[str, Any]] = []
    for review in batch:
        review_id = str(review.get("review_id") or "")
        if not review_id:
            continue
        ordered.append(normalized_by_id.get(review_id, _default_classification(review_id)))
    return ordered


async def run_classification(
    client: AsyncAnthropic,
    model: str,
    reviews: list[dict[str, Any]],
    changelog: str,
    known_issues: list[str],
    semaphore: asyncio.Semaphore,
    batch_size: int = DEFAULT_BATCH_SIZE,
    progress_callback: ProgressCallback | None = None,
) -> list[dict[str, Any]]:
    if not reviews:
        return []

    prompt_template = load_prompt("classify_batch.txt")
    batches = chunked(reviews, batch_size)
    total = len(batches)
    done = 0

    async def _guarded(batch: list[dict[str, Any]]) -> list[dict[str, Any]]:
        async with semaphore:
            return await _classify_batch(client, model, batch, prompt_template, changelog, known_issues)

    all_classifications: list[dict[str, Any]] = []
    tasks = [asyncio.create_task(_guarded(batch)) for batch in batches]
    for task in asyncio.as_completed(tasks):
        all_classifications.extend(await task)
        done += 1
        if progress_callback:
            maybe_awaitable = progress_callback(done, total)
            if asyncio.iscoroutine(maybe_awaitable):
                await maybe_awaitable

    return all_classifications


async def classify_reviews(
    reviews: list[dict[str, Any]],
    changelog: str = "",
    known_issues: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Compatibility wrapper for legacy alert mode."""
    if not reviews:
        return []

    client, model = get_client_and_model()
    semaphore = asyncio.Semaphore(MAX_BATCH_CONCURRENCY)
    return await run_classification(
        client=client,
        model=model,
        reviews=reviews,
        changelog=changelog,
        known_issues=known_issues or [],
        semaphore=semaphore,
    )
