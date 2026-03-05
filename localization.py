from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from llm import call_llm
from utils import (
    chunked,
    extract_json_text,
    log_event,
    to_json,
)
from config import TRANSLATION_BATCH_SIZE

LOCALIZED_RUNS_DIR = Path(__file__).resolve().parent / "data" / "localized-runs"


def _normalized_locale(locale: str | None) -> str:
    raw = (locale or "en").strip().lower()
    if raw.startswith("ru"):
        return "ru"
    return "en"


def _localized_cache_path(run_id: str, locale: str) -> Path:
    safe_run_id = "".join(ch for ch in (run_id or "unknown") if ch.isalnum() or ch in {"-", "_"})
    safe_locale = "".join(ch for ch in locale if ch.isalnum() or ch in {"-", "_"})
    return LOCALIZED_RUNS_DIR / f"{safe_run_id}.{safe_locale}.json"


def _load_cached_localized_run(run_id: str, locale: str) -> dict[str, Any] | None:
    cache_path = _localized_cache_path(run_id, locale)
    if not cache_path.exists():
        return None
    try:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_cached_localized_run(run_id: str, locale: str, payload: dict[str, Any]) -> None:
    LOCALIZED_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = _localized_cache_path(run_id, locale)
    cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _is_mostly_cyrillic(text: str) -> bool:
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return False
    cyr = sum(1 for ch in letters if "\u0400" <= ch <= "\u04FF")
    return (cyr / len(letters)) >= 0.6


def _needs_ru_translation(text: str) -> bool:
    candidate = text.strip()
    if not candidate:
        return False
    if _is_mostly_cyrillic(candidate):
        return False
    return True


async def _translate_batch_to_ru(rows: list[dict[str, str]]) -> dict[str, str]:
    if not rows:
        return {}

    prompt = (
        "Translate each review text to Russian.\n"
        "Return ONLY valid JSON array with this schema:\n"
        "[{\"id\":\"...\",\"text\":\"...\"}]\n"
        "Rules:\n"
        "- Keep meaning and tone.\n"
        "- Keep profanity, emojis and punctuation.\n"
        "- Do not add explanations.\n"
        "- If text is already Russian, return it unchanged.\n\n"
        f"Input JSON:\n{to_json(rows)}"
    )
    raw = await call_llm(prompt, task="translation", max_tokens=3200, temperature=0.1)
    parsed = json.loads(extract_json_text(raw))
    if not isinstance(parsed, list):
        return {}

    translated: dict[str, str] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id") or "").strip()
        item_text = str(item.get("text") or "").strip()
        if item_id and item_text:
            translated[item_id] = item_text
    return translated


async def _translate_reviews_to_ru(payload: dict[str, Any]) -> dict[str, Any]:
    reviews = payload.get("reviews")
    if not isinstance(reviews, list) or not reviews:
        return payload

    to_translate: list[dict[str, str]] = []
    for index, review in enumerate(reviews):
        if not isinstance(review, dict):
            continue
        text = str(review.get("text") or "")
        if not _needs_ru_translation(text):
            continue
        review_id = str(review.get("review_id") or f"idx-{index}")
        to_translate.append({"id": review_id, "text": text})

    if not to_translate:
        return payload

    translated_by_id: dict[str, str] = {}
    for batch in chunked(to_translate, TRANSLATION_BATCH_SIZE):
        try:
            translated_by_id.update(await _translate_batch_to_ru(batch))
        except Exception as exc:
            log_event(
                "run_localization_batch_failed",
                locale="ru",
                batch_size=len(batch),
                error=str(exc),
            )

    for index, review in enumerate(reviews):
        if not isinstance(review, dict):
            continue
        review_id = str(review.get("review_id") or f"idx-{index}")
        translated = translated_by_id.get(review_id)
        if not translated:
            continue
        original_text = str(review.get("text") or "")
        review["text_original"] = original_text
        review["text"] = translated

    return payload


async def localize_run_payload(payload: dict[str, Any], locale: str) -> dict[str, Any]:
    normalized_locale = _normalized_locale(locale)
    if normalized_locale == "en":
        return payload

    run_id = str(payload.get("run_id") or "").strip()
    if run_id:
        cached = _load_cached_localized_run(run_id, normalized_locale)
        if cached is not None:
            return cached

    if normalized_locale == "ru" and not os.getenv("LLM_API_KEY"):
        log_event(
            "run_localization_skipped",
            locale=normalized_locale,
            reason="missing_api_key",
            run_id=run_id or None,
        )
        return payload

    localized = deepcopy(payload)
    if normalized_locale == "ru":
        localized = await _translate_reviews_to_ru(localized)

    if run_id:
        try:
            _save_cached_localized_run(run_id, normalized_locale, localized)
        except Exception as exc:
            log_event(
                "run_localization_cache_write_failed",
                locale=normalized_locale,
                run_id=run_id,
                error=str(exc),
            )

    return localized
