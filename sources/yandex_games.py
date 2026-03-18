from __future__ import annotations

import asyncio
import html as html_module
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from typing import Any, Awaitable, Callable, Optional

try:
    from curl_cffi import requests as curl_requests
except ImportError:  # pragma: no cover - dependency may be absent in local test env
    curl_requests = None

try:
    from playwright.async_api import async_playwright
except ImportError:  # pragma: no cover - dependency may be absent in local test env
    async_playwright = None

YANDEX_GAMES_URL_RE = re.compile(r"^https://yandex\.ru/games/app/(?P<app_id>\d+)(?:[/?#].*)?$")
_GAME_PAYLOAD_RE_TEMPLATE = r'"game"\s*:\s*\{{[^{{}}]*"id"\s*:\s*"{app_id}"[^{{}}]*"title"\s*:\s*"(?P<title>[^"]+)"'
_TITLE_RE = re.compile(r"<title>(?P<title>[^<]+)</title>", re.IGNORECASE)
_OG_TITLE_RE = re.compile(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](?P<title>[^"\']+)["\']', re.IGNORECASE)


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


def _parse_epoch_millis(value: Any) -> str:
    seconds = int(value) / 1000
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()


def normalize_yandex_games_review(raw: dict[str, Any]) -> dict[str, Any]:
    lang = str(raw.get("language") or raw.get("textLanguage") or "ru").strip().lower() or "ru"
    created_at = raw.get("createdAt")
    if created_at:
        parsed_date = _parse_timestamp(str(created_at))
    elif raw.get("time") is not None:
        parsed_date = _parse_epoch_millis(raw.get("time"))
    else:
        raise ValueError("Yandex Games review payload does not contain a supported timestamp field")

    rating_raw = raw.get("rating")
    if isinstance(rating_raw, dict):
        rating = int(rating_raw.get("val") or 0)
    else:
        rating = int(rating_raw or 0)

    reactions = raw.get("reactions")
    thumbs_up = int(reactions.get("likesCount") or 0) if isinstance(reactions, dict) else 0
    return {
        "review_id": str(raw.get("id") or ""),
        "date": parsed_date,
        "rating": rating,
        "text": str(raw.get("text") or "").strip(),
        "version": None,
        "thumbs_up": thumbs_up,
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


def _get_playwright_user_data_dir(app_id: str) -> Path:
    profile_root = Path(__file__).resolve().parent.parent / ".playwright-state" / "yandex-games"
    return profile_root / app_id


async def _warm_playwright_page(page: Any, *, target_url: str) -> None:
    warmup_urls = (
        "https://yandex.ru/",
        "https://yandex.ru/games/",
        target_url,
    )
    for warmup_url in warmup_urls:
        await page.goto(warmup_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)


async def _get_playwright_page_content(url: str, *, country: str) -> str:
    if async_playwright is None:
        raise RuntimeError("playwright is required for Yandex Games browser fallback")

    app_id = extract_yandex_games_app_id(url)
    locale = f"{country.lower()}-{country.upper()}" if len(country) == 2 else "ru-RU"
    user_agent = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
    user_data_dir = _get_playwright_user_data_dir(app_id)
    user_data_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        context = await playwright.chromium.launch_persistent_context(
            str(user_data_dir),
            channel="chrome",
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
            locale=locale,
            user_agent=user_agent,
            viewport={"width": 1440, "height": 900},
            screen={"width": 1440, "height": 900},
            device_scale_factor=2,
            extra_http_headers={"Accept-Language": f"{country},en;q=0.9"},
        )
        try:
            await context.add_init_script(
                """
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'platform', {get: () => 'MacIntel'});
                Object.defineProperty(navigator, 'language', {get: () => 'ru-RU'});
                Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru', 'en-US', 'en']});
                """
            )
            page = context.pages[0] if getattr(context, "pages", None) else await context.new_page()
            await _warm_playwright_page(page, target_url=url)
            return await page.content()
        finally:
            await context.close()


def _extract_bootstrap_context(page_html: str, app_id: str) -> dict[str, Any]:
    pattern = re.compile(_GAME_PAYLOAD_RE_TEMPLATE.format(app_id=re.escape(app_id)), re.DOTALL)
    matched_game = pattern.search(page_html or "")
    if matched_game:
        app_name = matched_game.group("title")
    else:
        html_text = page_html or ""
        app_markers = (
            f"/games/app/{app_id}",
            f"app-id={app_id}",
            f'data-app-id="{app_id}"',
            f"appId\":\"{app_id}\"",
            f"app-{app_id}.games.s3.yandex.net",
        )
        if not any(marker in html_text for marker in app_markers):
            raise YandexGamesFallbackNeeded(f"Unable to extract bootstrap payload for requested game {app_id}")

        title_match = _OG_TITLE_RE.search(html_text) or _TITLE_RE.search(html_text)
        if not title_match:
            raise YandexGamesFallbackNeeded(f"Unable to extract game title for requested game {app_id}")

        app_name = title_match.group("title")
        app_name = html_module.unescape(app_name)
        app_name = app_name.replace(" — Яндекс Игры", "").strip()
        app_name = app_name.replace(" – Яндекс Игры", "").strip()
        app_name = app_name.replace(" - Яндекс Игры", "").strip()
        app_name = re.sub(r"\s*-\s*играть онлайн бесплатно.*$", "", app_name, flags=re.IGNORECASE).strip()
        if not app_name:
            raise YandexGamesFallbackNeeded(f"Unable to extract game title for requested game {app_id}")

    return {
        "app_id": app_id,
        "app_name": app_name,
        "html": page_html,
        "digest_url": (
            "https://yandex.ru/ugcpub/object-digest"
            f"?app_id=yandex-games&otype=Soft&object=%2Fontoid%2Fygs{app_id}&json=1&show_rating=1&view=games&theme=dark"
        ),
    }


async def _bootstrap_xhr_context(app_id: str, country: str) -> dict[str, Any]:
    url = f"https://yandex.ru/games/app/{app_id}"
    response = _get_impersonated_page(url, country=country)
    html = str(getattr(response, "text", "") or "")
    if not html:
        raise YandexGamesFallbackNeeded(f"Unable to load Yandex Games page for {app_id} in {country}")
    context = _extract_bootstrap_context(html, app_id)
    context["country"] = country
    return context


async def _bootstrap_playwright_context(app_id: str, country: str) -> dict[str, Any]:
    url = f"https://yandex.ru/games/app/{app_id}"
    html = await _get_playwright_page_content(url, country=country)
    if not html:
        raise YandexGamesFallbackNeeded(f"Unable to load Yandex Games page via Playwright for {app_id} in {country}")
    context = _extract_bootstrap_context(html, app_id)
    context["country"] = country
    context["bootstrap_via"] = "playwright"
    return context


def _with_offset(url: str, offset: int) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["offset"] = str(offset)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def _fetch_reviews_page(context: dict[str, Any], page_token: Optional[str] = None) -> dict[str, Any]:
    digest_url = str(context.get("digest_url") or "").strip()
    country = str(context.get("country") or "ru")
    if not digest_url:
        raise YandexGamesFallbackNeeded("Missing Yandex Games digest URL in bootstrap context")

    offset = int(page_token or "0")
    response = _get_impersonated_page(_with_offset(digest_url, offset), country=country)
    raw_body = str(getattr(response, "text", "") or "")
    if not raw_body:
        raise YandexGamesFallbackNeeded("Empty digest response from Yandex Games")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise YandexGamesFallbackNeeded("Unable to decode Yandex Games digest response") from exc

    digest = payload.get("digest") if isinstance(payload, dict) else None
    if not isinstance(digest, dict):
        raise YandexGamesFallbackNeeded("Yandex Games digest payload is missing digest object")

    reviews = digest.get("reviews")
    pager = digest.get("pager")
    if not isinstance(reviews, list):
        raise YandexGamesFallbackNeeded("Yandex Games digest payload has invalid reviews shape")

    total_count = None
    if isinstance(pager, dict):
        total_count = pager.get("realCount") or pager.get("totalCount")
    total_count_int = int(total_count) if total_count is not None else None

    next_page_token: Optional[str] = None
    if total_count_int is None:
        if reviews:
            next_page_token = str(offset + len(reviews))
    elif offset + len(reviews) < total_count_int:
        next_page_token = str(offset + len(reviews))

    return {
        "reviews": reviews,
        "nextPageToken": next_page_token,
        "totalCount": total_count_int,
    }


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
    try:
        context = await _retry_async(lambda: _bootstrap_xhr_context(app_id, country))
    except YandexGamesFallbackNeeded as bootstrap_error:
        try:
            context = await _retry_async(lambda: _bootstrap_playwright_context(app_id, country))
        except RuntimeError as exc:
            if "playwright is required" in str(exc):
                raise bootstrap_error
            raise

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
