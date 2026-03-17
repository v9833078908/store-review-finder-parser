from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

try:
    from curl_cffi import requests as curl_requests
except ImportError:  # pragma: no cover - dependency may be absent in local test env
    curl_requests = None

YANDEX_GAMES_URL_RE = re.compile(r"^https://yandex\.ru/games/app/(?P<app_id>\d+)(?:[/?#].*)?$")
_GAME_PAYLOAD_RE_TEMPLATE = r'"game"\s*:\s*\{{[^{{}}]*"id"\s*:\s*"{app_id}"[^{{}}]*"title"\s*:\s*"(?P<title>[^"]+)"'


class YandexGamesFallbackNeeded(RuntimeError):
    pass


_TRANSIENT_EXCEPTIONS = (TimeoutError, ConnectionError, asyncio.TimeoutError)


def extract_yandex_games_app_id(url: str) -> str:
    match = YANDEX_GAMES_URL_RE.match(str(url or "").strip())
    if not match:
        raise ValueError("Expected a direct Yandex Games URL like https://yandex.ru/games/app/<id>")
    return match.group("app_id")


def _parse_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.isoformat()


def normalize_yandex_games_review(raw: dict[str, Any]) -> dict[str, Any]:
    lang = str(raw.get("language") or "ru").strip().lower() or "ru"
    return {
        "review_id": str(raw.get("id") or ""),
        "date": _parse_timestamp(str(raw.get("createdAt") or "")),
        "rating": int(raw.get("rating") or 0),
        "text": str(raw.get("text") or "").strip(),
        "version": None,
        "thumbs_up": 0,
        "original_lang": lang,
        "lang": lang,
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }


def _get_impersonated_page(url: str, *, country: str) -> Any:
    if curl_requests is None:
        raise RuntimeError("curl_cffi is required for Yandex Games transport")

    headers = {
        "Accept-Language": f"{country},en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    }
    return curl_requests.get(url, impersonate="chrome124", timeout=30, headers=headers)


def _extract_bootstrap_context(html: str, app_id: str) -> dict[str, Any]:
    pattern = re.compile(_GAME_PAYLOAD_RE_TEMPLATE.format(app_id=re.escape(app_id)), re.DOTALL)
    matched_game = pattern.search(html or "")
    if not matched_game:
        raise YandexGamesFallbackNeeded(f"Unable to extract bootstrap payload for requested game {app_id}")

    return {
        "app_id": app_id,
        "app_name": matched_game.group("title"),
        "html": html,
    }


async def _bootstrap_xhr_context(app_id: str, country: str) -> dict[str, Any]:
    url = f"https://yandex.ru/games/app/{app_id}"
    response = _get_impersonated_page(url, country=country)
    html = str(getattr(response, "text", "") or "")
    if not html:
        raise YandexGamesFallbackNeeded(f"Unable to load Yandex Games page for {app_id} in {country}")
    return _extract_bootstrap_context(html, app_id)


async def _fetch_reviews_page(context: dict[str, Any], page_token: Optional[str] = None) -> dict[str, Any]:
    del context
    del page_token
    raise YandexGamesFallbackNeeded("XHR reviews fetch is unavailable")


def _is_transient_exception(exc: Exception) -> bool:
    return isinstance(exc, _TRANSIENT_EXCEPTIONS)


async def _retry_async(operation: Callable[[], Awaitable[Any]], *, attempts: int = 3) -> Any:
    last_error: Optional[Exception] = None
    for attempt in range(attempts):
        try:
            return await operation()
        except YandexGamesFallbackNeeded:
            raise
        except Exception as exc:  # pragma: no cover - defensive retry path
            if not _is_transient_exception(exc):
                raise
            last_error = exc
            if attempt == attempts - 1:
                raise
            await asyncio.sleep(2**attempt)
    if last_error is not None:
        raise last_error
    raise RuntimeError("retry loop exited unexpectedly")


async def fetch_yandex_games_reviews(
    url: str,
    max_reviews: int = 2000,
    country: str = "ru",
    force_refresh: bool = False,
    cache_ttl: Optional[Any] = None,
) -> dict[str, Any]:
    del force_refresh
    del cache_ttl

    if max_reviews <= 0:
        raise ValueError("max_reviews must be greater than zero.")

    app_id = extract_yandex_games_app_id(url)
    context = await _retry_async(lambda: _bootstrap_xhr_context(app_id, country))

    collected: list[dict[str, Any]] = []
    page_token: Optional[str] = None

    while len(collected) < max_reviews:
        page = await _retry_async(lambda: _fetch_reviews_page(context, page_token=page_token))
        raw_reviews = page.get("reviews") if isinstance(page, dict) else None
        if not isinstance(raw_reviews, list) or not raw_reviews:
            break

        for raw_review in raw_reviews:
            if isinstance(raw_review, dict):
                collected.append(normalize_yandex_games_review(raw_review))
                if len(collected) >= max_reviews:
                    break

        next_page_token = page.get("nextPageToken") if isinstance(page, dict) else None
        if not next_page_token:
            break
        page_token = str(next_page_token)

    app_metadata = context.get("app_metadata") if isinstance(context, dict) else {}
    if not isinstance(app_metadata, dict):
        app_metadata = {}

    return {
        "app_id": app_id,
        "app_name": str(context.get("app_name") or app_id) if isinstance(context, dict) else app_id,
        "country": country,
        "reviews": collected,
        "app_metadata": app_metadata,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "cache_hit": False,
    }
