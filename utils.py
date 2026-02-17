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
from typing import Any, TypeVar

from anthropic import AsyncAnthropic
from observability import (
    current_trace_id,
    observe,
    update_current_generation,
    update_current_span,
)

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
MAX_API_RETRIES = 3

T = TypeVar("T")


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


def parse_date(value: str | None) -> datetime | None:
    if not value:
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

    valid_dates = [parse_date(str(item.get("date") or "")) for item in reviews]
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


def get_client_and_model() -> tuple[AsyncAnthropic, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is missing.")
    model = os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    log_event("llm_client_initialized", provider="anthropic", model=model)
    return AsyncAnthropic(api_key=api_key), model


@observe(name="llm_call", as_type="generation", capture_input=False, capture_output=False)
async def call_model(
    client: AsyncAnthropic,
    model: str,
    prompt: str,
    max_tokens: int,
    temperature: float = 0.2,
    retries: int = MAX_API_RETRIES,
    prompt_name: str = "unknown",
) -> str:
    started = time.perf_counter()
    prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]
    log_event(
        "llm_call_started",
        provider="anthropic",
        model=model,
        prompt_name=prompt_name,
        prompt_chars=len(prompt),
        prompt_hash=prompt_hash,
        max_tokens=max_tokens,
        temperature=temperature,
        tools_enabled=False,
    )
    update_current_generation(
        name=f"llm:{prompt_name}",
        model=model,
        input={
            "prompt_name": prompt_name,
            "prompt_chars": len(prompt),
            "prompt_hash": prompt_hash,
        },
        metadata={
            "provider": "anthropic",
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        model_parameters={
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )
    for attempt in range(retries):
        try:
            attempt_started = time.perf_counter()
            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            chunks = [block.text for block in response.content if getattr(block, "type", "") == "text"]
            text = "".join(chunks).strip()
            log_event(
                "llm_call_succeeded",
                provider="anthropic",
                model=model,
                prompt_name=prompt_name,
                attempt=attempt + 1,
                duration_ms=round((time.perf_counter() - attempt_started) * 1000),
                total_duration_ms=round((time.perf_counter() - started) * 1000),
                output_chars=len(text),
                stop_reason=getattr(response, "stop_reason", None),
            )
            usage = getattr(response, "usage", None)
            usage_details: dict[str, int] = {}
            if usage is not None:
                for key in (
                    "input_tokens",
                    "output_tokens",
                    "cache_creation_input_tokens",
                    "cache_read_input_tokens",
                ):
                    value = getattr(usage, key, None)
                    if isinstance(value, int):
                        usage_details[key] = value

            update_current_generation(
                output={
                    "output_chars": len(text),
                    "stop_reason": getattr(response, "stop_reason", None),
                    "attempt": attempt + 1,
                },
                usage_details=usage_details or None,
                metadata={
                    "provider": "anthropic",
                    "prompt_name": prompt_name,
                },
                status_message="succeeded",
            )
            return text
        except Exception as exc:
            log_event(
                "llm_call_failed_attempt",
                provider="anthropic",
                model=model,
                prompt_name=prompt_name,
                attempt=attempt + 1,
                duration_ms=round((time.perf_counter() - attempt_started) * 1000),
                error=str(exc),
            )
            update_current_span(
                metadata={
                    "provider": "anthropic",
                    "prompt_name": prompt_name,
                    "failed_attempt": attempt + 1,
                    "error": str(exc),
                }
            )
            if attempt == retries - 1:
                log_event(
                    "llm_call_failed",
                    provider="anthropic",
                    model=model,
                    prompt_name=prompt_name,
                    total_duration_ms=round((time.perf_counter() - started) * 1000),
                    retries=retries,
                )
                update_current_generation(
                    output={"error": str(exc)},
                    status_message="failed",
                    metadata={"provider": "anthropic", "prompt_name": prompt_name},
                )
                raise
            await asyncio.sleep(2**attempt)
    return ""


def to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)
