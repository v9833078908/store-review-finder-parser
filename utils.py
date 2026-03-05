from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Awaitable, Callable, TypeVar

from observability import current_trace_id

DEFAULT_MODEL = "google/gemini-3-flash-preview"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

T = TypeVar("T")
R = TypeVar("R")


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _resolve_log_level(raw_level: str) -> int:
    normalized = (raw_level or "INFO").strip().upper()
    return {
        "CRITICAL": logging.CRITICAL,
        "ERROR": logging.ERROR,
        "WARNING": logging.WARNING,
        "INFO": logging.INFO,
        "DEBUG": logging.DEBUG,
    }.get(normalized, logging.INFO)


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("review_parser")
    if logger.handlers:
        return logger

    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(_resolve_log_level(os.getenv("APP_LOG_LEVEL", "INFO")))
    logger.propagate = False
    return logger


APP_LOGGER = _build_logger()


def log_event(event: str, **fields: Any) -> None:
    payload = {"event": event, **fields}
    trace_id = current_trace_id()
    if trace_id and "trace_id" not in payload:
        payload["trace_id"] = trace_id
    APP_LOGGER.info(json.dumps(payload, ensure_ascii=False, default=str))


# ---------------------------------------------------------------------------
# String utilities
# ---------------------------------------------------------------------------

def safe_name(value: str, fallback: str = "item") -> str:
    """Sanitise an arbitrary string for use as a filename or identifier."""
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    cleaned = cleaned.strip("_")
    return cleaned or fallback


def escape_table_cell(value: str) -> str:
    """Escape pipe characters in a markdown table cell."""
    return value.replace("|", "\\|")


def format_rating(value: float | None, fallback: float) -> str:
    """Format a rating float to two decimal places."""
    if value is None:
        return f"{fallback:.2f}"
    return f"{value:.2f}"


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    with path.open("r", encoding="utf-8") as handle:
        content = handle.read()
    log_event(
        "prompt_loaded",
        prompt=filename,
        version=hashlib.sha256(content.encode("utf-8")).hexdigest()[:12],
        chars=len(content),
    )
    return content


def prompt_version(filename: str) -> str:
    payload = load_prompt(filename).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def chunked(items: list[T], size: int) -> list[list[T]]:
    if size <= 0:
        raise ValueError("chunk size must be > 0")
    return [items[index : index + size] for index in range(0, len(items), size)]


def extract_json_text(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("[") or stripped.startswith("{"):
        return stripped

    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    start_array = text.find("[")
    end_array = text.rfind("]")
    if start_array != -1 and end_array > start_array:
        return text[start_array : end_array + 1]

    start_obj = text.find("{")
    end_obj = text.rfind("}")
    if start_obj != -1 and end_obj > start_obj:
        return text[start_obj : end_obj + 1]

    raise ValueError("No JSON payload found in model response.")


def parse_date(value: Any) -> datetime | None:
    """Parse a date string (or None/non-string) into a UTC-aware datetime."""
    if not value:
        return None
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def compact_review(review: dict[str, Any], max_text: int = 800) -> dict[str, Any]:
    return {
        "review_id": review.get("review_id"),
        "rating": review.get("rating"),
        "text": (review.get("text") or "")[:max_text],
        "version": review.get("version"),
        "lang": review.get("lang"),
        "date": review.get("date"),
    }


def review_stats(reviews: list[dict[str, Any]]) -> dict[str, Any]:
    ratings = [int(item.get("rating") or 0) for item in reviews if item.get("rating")]
    avg_rating = round(mean(ratings), 2) if ratings else 0.0

    valid_dates = [parse_date(item.get("date")) for item in reviews]
    valid_dates = [value for value in valid_dates if value is not None]
    if valid_dates:
        period = f"{min(valid_dates).date().isoformat()} to {max(valid_dates).date().isoformat()}"
    else:
        period = "unknown"

    lang_counts: dict[str, int] = {}
    for review in reviews:
        lang = str(review.get("lang") or "unknown")
        lang_counts[lang] = lang_counts.get(lang, 0) + 1
    dominant_lang = max(lang_counts.items(), key=lambda item: item[1])[0] if lang_counts else "unknown"

    return {
        "reviews_analyzed": len(reviews),
        "avg_rating": avg_rating,
        "period": period,
        "lang_counts": lang_counts,
        "dominant_lang": dominant_lang,
    }


def build_category_counts(classified: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in classified:
        category = str(item.get("category") or "unknown")
        counts[category] = counts.get(category, 0) + 1
    return counts


def to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Generic batch processor
# ---------------------------------------------------------------------------

ProgressCallback = Callable[[int, int], Awaitable[None] | None]


async def run_batched(
    items: list[T],
    batch_size: int,
    processor: Callable[[list[T]], Awaitable[list[R]]],
    semaphore: asyncio.Semaphore,
    progress_callback: ProgressCallback | None = None,
) -> list[R]:
    """Process *items* in batches of *batch_size* with semaphore-guarded concurrency.

    *processor* receives one batch (list[T]) and must return list[R].
    Results are collected in completion order (not input order).
    """
    if not items:
        return []

    batches = chunked(items, batch_size)
    total = len(batches)
    done = 0

    async def _guarded(batch: list[T]) -> list[R]:
        async with semaphore:
            return await processor(batch)

    results: list[R] = []
    tasks = [asyncio.create_task(_guarded(batch)) for batch in batches]
    for task in asyncio.as_completed(tasks):
        results.extend(await task)
        done += 1
        if progress_callback:
            maybe_awaitable = progress_callback(done, total)
            if asyncio.iscoroutine(maybe_awaitable):
                await maybe_awaitable

    return results
