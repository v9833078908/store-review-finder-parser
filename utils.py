from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, TypeVar

from anthropic import AsyncAnthropic

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
MAX_API_RETRIES = 3

T = TypeVar("T")


def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    with path.open("r", encoding="utf-8") as handle:
        return handle.read()


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
    return AsyncAnthropic(api_key=api_key), model


async def call_model(
    client: AsyncAnthropic,
    model: str,
    prompt: str,
    max_tokens: int,
    temperature: float = 0.2,
    retries: int = MAX_API_RETRIES,
) -> str:
    for attempt in range(retries):
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            chunks = [block.text for block in response.content if getattr(block, "type", "") == "text"]
            return "".join(chunks).strip()
        except Exception:
            if attempt == retries - 1:
                raise
            await asyncio.sleep(2**attempt)
    return ""


def to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)
