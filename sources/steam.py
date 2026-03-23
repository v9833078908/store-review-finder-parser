from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import httpx

STEAM_URL_RE = re.compile(r"^https://store\.steampowered\.com/app/(?P<app_id>\d+)(?:/[^?#]*)?(?:[?#].*)?$")
STEAM_REVIEWS_PAGE_SIZE = 100


class SteamScraperError(RuntimeError):
    pass


def extract_steam_app_id(url: str) -> str:
    match = STEAM_URL_RE.match(str(url or "").strip())
    if not match:
        raise ValueError("Expected a direct Steam Store game URL like https://store.steampowered.com/app/<app_id>/<slug>/")
    return match.group("app_id")


def _normalize_steam_language(raw_lang: Any) -> str:
    normalized = str(raw_lang or "").strip().lower()
    if normalized in {"russian", "ru", "ru_ru"}:
        return "russian"
    if normalized in {"english", "en", "en_us"}:
        return "english"
    return normalized or "russian"


def _parse_steam_timestamp(value: Any) -> str:
    timestamp = int(value or 0)
    parsed = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    return parsed.isoformat()


def normalize_steam_review(raw: dict[str, Any]) -> dict[str, Any]:
    lang_raw = _normalize_steam_language(raw.get("language"))
    lang = "ru" if lang_raw == "russian" else "en" if lang_raw == "english" else lang_raw
    author = raw.get("author") if isinstance(raw.get("author"), dict) else {}

    payload = {
        "review_id": str(raw.get("recommendationid") or ""),
        "date": _parse_steam_timestamp(raw.get("timestamp_created")),
        "rating": 5 if bool(raw.get("voted_up")) else 1,
        "text": str(raw.get("review") or "").strip(),
        "version": None,
        "thumbs_up": int(raw.get("votes_up") or 0),
        "original_lang": lang,
        "lang": lang,
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
        "author_name": str(author.get("personaname") or "").strip(),
        "author_id": str(author.get("steamid") or "").strip(),
        "playtime_minutes": int(author.get("playtime_at_review") or 0),
        "comment_count": int(raw.get("comment_count") or 0),
        "steam_purchase": bool(raw.get("steam_purchase")),
        "received_for_free": bool(raw.get("received_for_free")),
    }
    return payload


async def _fetch_steam_app_details(app_id: str, lang: str) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://store.steampowered.com/api/appdetails",
            params={"appids": app_id, "l": lang},
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()

    app_payload = payload.get(app_id) if isinstance(payload, dict) else None
    if not isinstance(app_payload, dict) or not app_payload.get("success"):
        raise SteamScraperError(f"Steam app details response is invalid for {app_id}")

    data = app_payload.get("data")
    if not isinstance(data, dict):
        raise SteamScraperError(f"Steam app details payload is missing data for {app_id}")

    app_name = str(data.get("name") or app_id).strip()
    release_date = data.get("release_date") if isinstance(data.get("release_date"), dict) else {}
    return {
        "app_name": app_name,
        "app_metadata": {
            "app_name": app_name,
            "version": None,
            "recent_changes": "",
            "last_updated_on": str(release_date.get("date") or ""),
            "score": None,
            "ratings": None,
            "histogram": [],
        },
    }


async def _fetch_steam_reviews_page(*, app_id: str, language: str, cursor: str, num_per_page: int) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://store.steampowered.com/appreviews/{app_id}",
            params={
                "json": 1,
                "filter": "recent",
                "language": language,
                "review_type": "all",
                "purchase_type": "all",
                "num_per_page": num_per_page,
                "cursor": cursor,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, dict):
        raise SteamScraperError(f"Steam reviews response is invalid for {app_id}")
    return payload


async def fetch_steam_reviews(
    url: str,
    max_reviews: int = 100,
    lang: str = "ru",
    force_refresh: bool = False,
    cache_ttl: Any | None = None,
) -> dict[str, Any]:
    del force_refresh
    del cache_ttl

    app_id = extract_steam_app_id(url)
    normalized_lang = _normalize_steam_language(lang)
    target_reviews = max(1, int(max_reviews))

    try:
        app_details = await _fetch_steam_app_details(app_id, normalized_lang)
    except Exception as exc:
        raise SteamScraperError(f"Steam app details fetch failed for {app_id}") from exc

    app_name = str(app_details.get("app_name") or app_id)
    app_metadata = app_details.get("app_metadata") if isinstance(app_details.get("app_metadata"), dict) else {}

    reviews: list[dict[str, Any]] = []
    cursor = "*"
    while len(reviews) < target_reviews:
        try:
            page_payload = await _fetch_steam_reviews_page(
                app_id=app_id,
                language=normalized_lang,
                cursor=cursor,
                num_per_page=STEAM_REVIEWS_PAGE_SIZE,
            )
        except Exception as exc:
            raise SteamScraperError(f"Steam reviews fetch failed for {app_id}") from exc

        raw_reviews = page_payload.get("reviews")
        if not isinstance(raw_reviews, list):
            raise SteamScraperError(f"Steam reviews payload is missing reviews for {app_id}")

        for raw_review in raw_reviews:
            if not isinstance(raw_review, dict):
                continue
            reviews.append(normalize_steam_review(raw_review))
            if len(reviews) >= target_reviews:
                break

        next_cursor = str(page_payload.get("cursor") or "").strip()
        if not raw_reviews or not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    fetched_at = datetime.now(timezone.utc).isoformat()
    return {
        "app_id": app_id,
        "app_name": app_name,
        "lang": normalized_lang,
        "reviews": reviews[:target_reviews],
        "app_metadata": app_metadata,
        "fetched_at": fetched_at,
        "cache_hit": False,
        "store": "steam",
    }
