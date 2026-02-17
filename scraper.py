from __future__ import annotations

import json
import math
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google_play_scraper import Sort, app, reviews

DATA_DIR = Path(__file__).resolve().parent / "data"
CACHE_TTL = timedelta(hours=24)
MAX_RETRIES = 3
PAGE_DELAY_SECONDS = 2
MAX_PAGE_SIZE = 300
REGION_LANGUAGE_SWEEP = [
    "en",
    "ru",
    "es",
    "pt",
    "de",
    "fr",
    "it",
    "tr",
    "pl",
    "nl",
    "ja",
    "ko",
    "zh-cn",
    "ar",
    "hi",
    "id",
    "th",
    "vi",
    "uk",
    "ms",
]


def _cache_path(package_name: str) -> Path:
    return DATA_DIR / f"{package_name}.json"


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _load_cache(package_name: str, cache_ttl: timedelta) -> dict | None:
    path = _cache_path(package_name)
    if not path.exists():
        return None

    try:
        with path.open("r", encoding="utf-8") as handle:
            cached = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

    fetched_at = cached.get("fetched_at")
    if not fetched_at:
        return None

    cache_age = datetime.now(timezone.utc) - _parse_timestamp(fetched_at)
    if cache_age > cache_ttl:
        return None

    return cached


def _save_cache(package_name: str, payload: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(package_name)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def _retryable_fetch(*, package_name: str, lang: str, country: str, count: int, token: str | None):
    for attempt in range(MAX_RETRIES):
        try:
            return reviews(
                package_name,
                lang=lang,
                country=country,
                sort=Sort.NEWEST,
                count=count,
                continuation_token=token,
            )
        except Exception:
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep(2**attempt)

    return [], None


def fetch_app_metadata(package_name: str, lang: str, country: str) -> dict:
    """
    Fetch full app metadata from Google Play.

    Returns dict with: app_name, version, recent_changes, last_updated_on, score, ratings, histogram
    """
    for attempt in range(MAX_RETRIES):
        try:
            metadata = app(package_name, lang=lang, country=country)
            return {
                "app_name": metadata.get("title", package_name),
                "version": metadata.get("version"),
                "recent_changes": metadata.get("recentChanges", ""),
                "last_updated_on": metadata.get("lastUpdatedOn", ""),
                "score": metadata.get("score"),
                "ratings": metadata.get("ratings"),
                "histogram": metadata.get("histogram", []),
            }
        except Exception:
            if attempt == MAX_RETRIES - 1:
                break
            time.sleep(2**attempt)

    # Fallback if all retries fail
    return {
        "app_name": package_name,
        "version": None,
        "recent_changes": "",
        "last_updated_on": "",
        "score": None,
        "ratings": None,
        "histogram": [],
    }


def _normalize_review(raw: dict, lang: str) -> dict:
    created_at = raw.get("at")
    if isinstance(created_at, datetime):
        date_value = created_at.astimezone(timezone.utc).isoformat()
    else:
        date_value = str(created_at or "")

    return {
        "review_id": str(raw.get("reviewId", "")),
        "date": date_value,
        "rating": int(raw.get("score") or 0),
        "text": (raw.get("content") or "").strip(),
        "version": raw.get("reviewCreatedVersion"),
        "thumbs_up": int(raw.get("thumbsUpCount") or 0),
        "original_lang": lang,
        "lang": lang,
    }


def _fetch_for_language(package_name: str, lang: str, country: str, target_count: int) -> list[dict]:
    collected: list[dict] = []
    continuation_token = None

    while len(collected) < target_count:
        page_size = min(MAX_PAGE_SIZE, target_count - len(collected))
        page, continuation_token = _retryable_fetch(
            package_name=package_name,
            lang=lang,
            country=country,
            count=page_size,
            token=continuation_token,
        )

        if not page:
            break

        collected.extend(_normalize_review(item, lang) for item in page)
        if continuation_token is None:
            break

        time.sleep(PAGE_DELAY_SECONDS)

    return collected


def _safe_review_date(review: dict) -> datetime:
    value = review.get("date")
    try:
        return _parse_timestamp(value)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def fetch_reviews(
    package_name: str,
    max_reviews: int = 2000,
    langs: list[str] | None = None,
    country: str = "us",
    force_refresh: bool = False,
    cache_ttl: timedelta | None = None,
) -> dict:
    if max_reviews <= 0:
        raise ValueError("max_reviews must be greater than zero.")

    languages = [item.strip() for item in (langs or ["en", "ru"]) if item.strip()]
    if not languages:
        raise ValueError("At least one language must be provided.")

    effective_ttl = cache_ttl if cache_ttl is not None else CACHE_TTL
    cached = None if force_refresh else _load_cache(package_name, effective_ttl)
    if (
        cached
        and cached.get("country") == country
        and sorted(cached.get("langs", [])) == sorted(languages)
        and isinstance(cached.get("reviews"), list)
        and len(cached["reviews"]) >= max_reviews
    ):
        payload = dict(cached)
        payload["reviews"] = payload["reviews"][:max_reviews]
        for review in payload["reviews"]:
            if "original_lang" not in review:
                review["original_lang"] = review.get("lang") or languages[0]
        # Fetch fresh app metadata even when using cached reviews
        app_metadata = fetch_app_metadata(package_name, languages[0], country)
        payload["app_metadata"] = app_metadata
        payload["cache_hit"] = True
        return payload

    app_metadata = fetch_app_metadata(package_name, languages[0], country)
    per_lang_target = max(1, math.ceil(max_reviews / len(languages)))

    by_review_id: dict[str, dict] = {}
    for lang in languages:
        for review in _fetch_for_language(package_name, lang, country, per_lang_target):
            review_id = review["review_id"]
            if not review_id:
                continue
            if review_id not in by_review_id:
                by_review_id[review_id] = review

    merged_reviews = sorted(by_review_id.values(), key=_safe_review_date, reverse=True)[:max_reviews]
    payload = {
        "app_name": app_metadata["app_name"],
        "package_name": package_name,
        "country": country,
        "langs": languages,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "cache_hit": False,
        "reviews": merged_reviews,
        "app_metadata": app_metadata,
    }
    _save_cache(package_name, payload)
    return payload
