from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any

import httpx

APP_STORE_ID_PATTERN = re.compile(r"^\d+$")
APP_STORE_URL_ID_PATTERN = re.compile(r"/id(?P<app_id>\d+)(?:[/?#]|$)")
APP_STORE_PAGE_SIZE = 50
APP_STORE_PAGE_LIMIT = 10
APP_STORE_MAX_REVIEWS = APP_STORE_PAGE_SIZE * APP_STORE_PAGE_LIMIT
LOOKUP_URL = "https://itunes.apple.com/lookup"


def extract_app_store_id(value: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError("App Store app_id must be a numeric value.")
    if APP_STORE_ID_PATTERN.fullmatch(normalized):
        return normalized
    match = APP_STORE_URL_ID_PATTERN.search(normalized)
    if match:
        return match.group("app_id")
    raise ValueError("App Store app_id must be a numeric value.")


def validate_app_store_id(app_id: str) -> str:
    normalized = extract_app_store_id(app_id)
    return normalized


def clamp_max_reviews(max_reviews: int) -> int:
    return max(1, min(int(max_reviews), APP_STORE_MAX_REVIEWS))


def build_customer_reviews_url(country: str, app_id: str, page: int) -> str:
    normalized_country = (country or "us").strip().lower() or "us"
    normalized_page = max(1, min(int(page), APP_STORE_PAGE_LIMIT))
    normalized_app_id = validate_app_store_id(app_id)
    return (
        f"https://itunes.apple.com/{normalized_country}/rss/customerreviews/"
        f"page={normalized_page}/id={normalized_app_id}/sortby=mostrecent/json"
    )


def _get_label(value: Any) -> str:
    if isinstance(value, dict):
        label = value.get("label")
        if isinstance(label, str):
            return label.strip()
    if isinstance(value, str):
        return value.strip()
    return ""


def _parse_entry_timestamp(value: str) -> str:
    if not value:
        return ""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.isoformat()


def _normalize_review_entry(entry: dict[str, Any], default_lang: str = "en") -> dict[str, Any]:
    rating_raw = _get_label(entry.get("im:rating"))
    text_value = _get_label(entry.get("content"))
    version_value = _get_label(entry.get("im:version")) or None
    updated_value = _parse_entry_timestamp(_get_label(entry.get("updated")))
    review_id = _get_label(entry.get("id"))
    lang = (default_lang or "en").strip().lower() or "en"

    return {
        "review_id": review_id,
        "date": updated_value,
        "rating": int(rating_raw or 0),
        "text": text_value,
        "version": version_value,
        "thumbs_up": 0,
        "original_lang": lang,
        "lang": lang,
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }


def _extract_feed_entries(payload: dict[str, Any]) -> list[dict[str, Any]]:
    feed = payload.get("feed")
    if not isinstance(feed, dict):
        return []
    entries = feed.get("entry")
    if isinstance(entries, list):
        return [item for item in entries if isinstance(item, dict) and item.get("im:rating")]
    if isinstance(entries, dict) and entries.get("im:rating"):
        return [entries]
    return []


def _extract_app_metadata(lookup_payload: dict[str, Any], app_id: str) -> tuple[dict[str, Any], str]:
    results = lookup_payload.get("results")
    if not isinstance(results, list) or not results:
        raise LookupError(f"App Store app not found: {app_id}")

    app = results[0] if isinstance(results[0], dict) else {}
    track_name = str(app.get("trackName") or app_id)
    average_rating = app.get("averageUserRating")
    ratings_count = app.get("userRatingCount")
    return (
        {
            "app_name": track_name,
            "version": app.get("version"),
            "recent_changes": app.get("releaseNotes") or "",
            "last_updated_on": app.get("currentVersionReleaseDate") or app.get("releaseDate") or "",
            "score": average_rating,
            "ratings": ratings_count,
            "histogram": [],
        },
        track_name,
    )


async def _fetch_json(client: httpx.AsyncClient, url: str) -> dict[str, Any]:
    response = await client.get(url, timeout=30.0)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise LookupError("Unexpected App Store response payload.")
    return payload


async def resolve_app_store_input(app_id: str, country: str = "us") -> dict[str, Any]:
    normalized_app_id = validate_app_store_id(app_id)
    normalized_country = (country or "us").strip().lower() or "us"

    async with httpx.AsyncClient() as client:
        lookup_payload = await _fetch_json(
            client,
            f"{LOOKUP_URL}?id={normalized_app_id}&country={normalized_country}",
        )

    app_metadata, app_name = _extract_app_metadata(lookup_payload, normalized_app_id)
    return {
        "input_type": "app_store_id",
        "recommended_app_id": normalized_app_id,
        "candidates": [
            {
                "app_id": normalized_app_id,
                "title": app_name,
                "url": f"https://apps.apple.com/app/id{normalized_app_id}",
                "score": app_metadata.get("score"),
                "reviews_count": app_metadata.get("ratings"),
                "is_top1": True,
            }
        ],
    }


async def fetch_app_store_reviews(
    app_id: str,
    max_reviews: int = APP_STORE_MAX_REVIEWS,
    country: str = "us",
    force_refresh: bool = False,
    cache_ttl: Any | None = None,
) -> dict[str, Any]:
    del force_refresh
    del cache_ttl

    normalized_app_id = validate_app_store_id(app_id)
    normalized_country = (country or "us").strip().lower() or "us"
    target_reviews = clamp_max_reviews(max_reviews)
    pages = max(1, min(APP_STORE_PAGE_LIMIT, math.ceil(target_reviews / APP_STORE_PAGE_SIZE)))

    async with httpx.AsyncClient() as client:
        lookup_payload = await _fetch_json(
            client,
            f"{LOOKUP_URL}?id={normalized_app_id}&country={normalized_country}",
        )
        app_metadata, app_name = _extract_app_metadata(lookup_payload, normalized_app_id)

        reviews: list[dict[str, Any]] = []
        for page in range(1, pages + 1):
            payload = await _fetch_json(
                client,
                build_customer_reviews_url(normalized_country, normalized_app_id, page),
            )
            page_entries = _extract_feed_entries(payload)
            if not page_entries:
                break
            reviews.extend(_normalize_review_entry(entry) for entry in page_entries)
            if len(reviews) >= target_reviews:
                break

    fetched_at = datetime.now(timezone.utc).isoformat()
    return {
        "app_id": normalized_app_id,
        "app_name": app_name,
        "country": normalized_country,
        "reviews": reviews[:target_reviews],
        "app_metadata": app_metadata,
        "fetched_at": fetched_at,
        "cache_hit": False,
    }
