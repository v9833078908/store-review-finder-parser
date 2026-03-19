from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

VK_PLAY_URL_RE = re.compile(r"^https://vkplay\.ru/play/game/(?P<slug>[^/?#]+)(?:[/?#].*)?$")
VK_PLAY_PAGE_LIMIT = 50
VK_PLAY_DEFAULT_LANG = "ru_RU"


class VKPlayScraperError(RuntimeError):
    pass


def extract_vk_play_slug(url: str) -> str:
    match = VK_PLAY_URL_RE.match(str(url or "").strip())
    if not match:
        raise ValueError("Expected a direct VK Play game URL like https://vkplay.ru/play/game/<slug>")
    return match.group("slug")


def _map_vk_play_lang(lang: str | None) -> str:
    normalized = str(lang or "").strip().lower()
    if normalized == "en":
        return "en_US"
    if normalized == "ru":
        return "ru_RU"
    return VK_PLAY_DEFAULT_LANG


def _normalize_review_lang(raw_lang: Any) -> str:
    normalized = str(raw_lang or "ru").strip().lower()
    if not normalized:
        return "ru"
    return normalized.split("_", 1)[0]


def _parse_review_timestamp(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        raise VKPlayScraperError("VK Play review payload does not contain a timestamp")

    parsed: datetime
    if "T" in raw:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    else:
        parsed = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.isoformat()


def normalize_vk_play_review(raw: dict[str, Any]) -> dict[str, Any]:
    author = raw.get("author")
    author_name = ""
    playtime_seconds = None
    if isinstance(author, dict):
        author_name = str(author.get("nick") or "").strip()
        time_spend = author.get("time_spend")
        if time_spend is not None:
            playtime_seconds = int(time_spend)

    lang = _normalize_review_lang(raw.get("lang"))
    rating_raw = raw.get("rating")
    if isinstance(rating_raw, dict):
        rating_value = rating_raw.get("val")
    else:
        rating_value = rating_raw

    payload = {
        "review_id": str(raw.get("id") or ""),
        "date": _parse_review_timestamp(raw.get("date_added")),
        "rating": int(float(rating_value or 0)),
        "text": str(raw.get("text") or "").strip(),
        "version": None,
        "thumbs_up": int(raw.get("likes") or 0),
        "original_lang": lang,
        "lang": lang,
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }
    if author_name:
        payload["author_name"] = author_name
    if playtime_seconds is not None:
        payload["playtime_seconds"] = playtime_seconds
    return payload


async def _fetch_vk_play_catalog(slug: str, lang: str) -> dict[str, Any]:
    url = f"https://api.vkplay.ru/catalog/v1/game/{slug}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params={"lang": lang}, timeout=30.0)
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, dict):
        raise VKPlayScraperError("VK Play catalog response is invalid")
    return payload


async def _fetch_vk_play_reviews_page(
    *,
    game_id: int,
    lang: str,
    next_url: str | None,
    limit: int,
) -> dict[str, Any]:
    url = next_url or "https://api.vkplay.ru/play/microreviews_v2/"
    params = None
    if next_url is None:
        params = {
            "isPopup": "false",
            "game_id": game_id,
            "header_lang": lang,
            "filter": "first_best",
            "lang": lang,
            "duration": "all",
            "limit": limit,
        }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=30.0)
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, dict):
        raise VKPlayScraperError("VK Play reviews response is invalid")
    return payload


def _extract_catalog_game(catalog_payload: dict[str, Any], slug: str) -> tuple[int, str, dict[str, Any]]:
    game_id = catalog_payload.get("id")
    if not isinstance(game_id, int):
        raise VKPlayScraperError(f"VK Play catalog payload is missing numeric game id for {slug}")

    app_name = str(catalog_payload.get("name") or "").strip()
    if not app_name:
        raise VKPlayScraperError(f"VK Play catalog payload is missing game name for {slug}")

    app_metadata = {
        "app_name": app_name,
        "version": catalog_payload.get("gcFields", {}).get("gcDistrVersion") if isinstance(catalog_payload.get("gcFields"), dict) else None,
        "recent_changes": "",
        "last_updated_on": "",
        "score": catalog_payload.get("avgRating"),
        "ratings": catalog_payload.get("reviewsCount"),
        "histogram": [],
    }
    return game_id, app_name, app_metadata


async def fetch_vk_play_reviews(
    url: str,
    max_reviews: int = 50,
    lang: str = "ru",
    force_refresh: bool = False,
    cache_ttl: Any | None = None,
) -> dict[str, Any]:
    del force_refresh
    del cache_ttl

    slug = extract_vk_play_slug(url)
    normalized_lang = _map_vk_play_lang(lang)
    target_reviews = max(1, int(max_reviews))

    try:
        catalog_payload = await _fetch_vk_play_catalog(slug, normalized_lang)
    except Exception as exc:
        raise VKPlayScraperError(f"VK Play catalog fetch failed for {slug}") from exc

    try:
        game_id, app_name, app_metadata = _extract_catalog_game(catalog_payload, slug)
    except VKPlayScraperError:
        raise
    except Exception as exc:
        raise VKPlayScraperError(f"VK Play catalog parse failed for {slug}") from exc

    reviews: list[dict[str, Any]] = []
    next_url: str | None = None
    page_limit = VK_PLAY_PAGE_LIMIT

    while len(reviews) < target_reviews:
        try:
            page_payload = await _fetch_vk_play_reviews_page(
                game_id=game_id,
                lang=normalized_lang,
                next_url=next_url,
                limit=page_limit,
            )
        except Exception as exc:
            raise VKPlayScraperError(f"VK Play reviews fetch failed for {slug}") from exc

        results = page_payload.get("results")
        if not isinstance(results, list):
            raise VKPlayScraperError(f"VK Play reviews payload is missing results for {slug}")

        for raw_review in results:
            if not isinstance(raw_review, dict):
                continue
            reviews.append(normalize_vk_play_review(raw_review))
            if len(reviews) >= target_reviews:
                break

        next_value = page_payload.get("next")
        if not next_value or len(reviews) >= target_reviews:
            break
        next_url = str(next_value)

    fetched_at = datetime.now(timezone.utc).isoformat()
    return {
        "app_id": str(game_id),
        "app_name": app_name,
        "lang": normalized_lang,
        "reviews": reviews[:target_reviews],
        "app_metadata": app_metadata,
        "fetched_at": fetched_at,
        "cache_hit": False,
        "store": "vk_play",
    }
