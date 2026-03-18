from __future__ import annotations

import asyncio
import json
from typing import Optional

import pytest

from sources.yandex_games import (
    extract_yandex_games_app_id,
    fetch_yandex_games_reviews,
    _get_playwright_browser_launch_kwargs,
    _bootstrap_xhr_context,
    _get_playwright_page_content,
    normalize_yandex_games_review,
    YandexGamesFallbackNeeded,
)


def test_extract_yandex_games_app_id_accepts_direct_game_url() -> None:
    assert extract_yandex_games_app_id("https://yandex.ru/games/app/423744") == "423744"


def test_extract_yandex_games_app_id_rejects_non_game_url() -> None:
    try:
        extract_yandex_games_app_id("https://yandex.ru/games")
    except ValueError as exc:
        assert "Yandex Games" in str(exc)
    else:
        raise AssertionError("Expected ValueError for invalid Yandex Games URL")


def test_normalize_yandex_games_review_maps_payload_to_internal_shape() -> None:
    review = normalize_yandex_games_review(
        {
            "id": "rev-1",
            "createdAt": "2026-03-17T10:15:00+03:00",
            "rating": 4,
            "text": "Good game",
            "language": "ru",
        }
    )

    assert review == {
        "review_id": "rev-1",
        "date": "2026-03-17T07:15:00+00:00",
        "rating": 4,
        "text": "Good game",
        "version": None,
        "thumbs_up": 0,
        "original_lang": "ru",
        "lang": "ru",
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }


def test_normalize_yandex_games_review_maps_digest_payload_to_internal_shape() -> None:
    review = normalize_yandex_games_review(
        {
            "id": "rev-2",
            "time": 1773119600016,
            "rating": {"val": 1, "max": 5},
            "text": "NE GRUZITSA",
            "textLanguage": "RU",
            "reactions": {"likesCount": 3},
        }
    )

    assert review == {
        "review_id": "rev-2",
        "date": "2026-03-10T05:13:20.016000+00:00",
        "rating": 1,
        "text": "NE GRUZITSA",
        "version": None,
        "thumbs_up": 3,
        "original_lang": "ru",
        "lang": "ru",
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }


def test_fetch_yandex_games_reviews_follows_next_page_token(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[Optional[str]] = []

    async def fake_bootstrap_xhr_context(app_id: str, country: str) -> dict[str, str]:
        assert app_id == "423744"
        assert country == "ru"
        return {"app_id": app_id, "country": country, "reviews_url": "https://example.invalid/reviews"}

    async def fake_fetch_reviews_page(context: dict[str, str], page_token: Optional[str] = None) -> dict[str, object]:
        calls.append(page_token)
        if page_token is None:
            return {
                "reviews": [
                    {"id": "rev-1", "createdAt": "2026-03-17T10:15:00+03:00", "rating": 5, "text": "A", "language": "ru"}
                ],
                "nextPageToken": "token-2",
            }
        assert page_token == "token-2"
        return {
            "reviews": [
                {"id": "rev-2", "createdAt": "2026-03-16T10:15:00+03:00", "rating": 4, "text": "B", "language": "ru"}
            ],
            "nextPageToken": None,
        }

    monkeypatch.setattr("sources.yandex_games._bootstrap_xhr_context", fake_bootstrap_xhr_context)
    monkeypatch.setattr("sources.yandex_games._fetch_reviews_page", fake_fetch_reviews_page)

    payload = asyncio.run(fetch_yandex_games_reviews("https://yandex.ru/games/app/423744", max_reviews=10, country="ru"))

    assert calls == [None, "token-2"]
    assert [item["review_id"] for item in payload["reviews"]] == ["rev-1", "rev-2"]
    assert payload["app_id"] == "423744"
    assert payload["country"] == "ru"


def test_fetch_yandex_games_reviews_surfaces_fallback_needed(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_bootstrap_xhr_context(app_id: str, country: str) -> dict[str, str]:
        raise YandexGamesFallbackNeeded(f"bootstrap failed for {app_id} in {country}")

    async def fake_bootstrap_playwright_context(app_id: str, country: str) -> dict[str, str]:
        raise YandexGamesFallbackNeeded(f"playwright bootstrap failed for {app_id} in {country}")

    monkeypatch.setattr("sources.yandex_games._bootstrap_xhr_context", fake_bootstrap_xhr_context)
    monkeypatch.setattr("sources.yandex_games._bootstrap_playwright_context", fake_bootstrap_playwright_context)

    with pytest.raises(YandexGamesFallbackNeeded, match="bootstrap failed"):
        asyncio.run(fetch_yandex_games_reviews("https://yandex.ru/games/app/423744", country="ru"))


def test_fetch_yandex_games_reviews_falls_back_to_playwright_bootstrap(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    async def fake_bootstrap_xhr_context(app_id: str, country: str) -> dict[str, str]:
        calls.append("xhr")
        raise YandexGamesFallbackNeeded("captcha")

    async def fake_bootstrap_playwright_context(app_id: str, country: str) -> dict[str, str]:
        calls.append("playwright")
        assert app_id == "423744"
        assert country == "ru"
        return {
            "app_id": app_id,
            "country": country,
            "app_name": "Firestone",
            "digest_url": "https://example.invalid/digest",
        }

    async def fake_fetch_reviews_page(context: dict[str, str], page_token: Optional[str] = None) -> dict[str, object]:
        assert context["app_name"] == "Firestone"
        assert page_token is None
        return {
            "reviews": [
                {"id": "rev-1", "time": 1773119600016, "rating": {"val": 5}, "text": "A", "textLanguage": "RU"}
            ],
            "nextPageToken": None,
        }

    monkeypatch.setattr("sources.yandex_games._bootstrap_xhr_context", fake_bootstrap_xhr_context)
    monkeypatch.setattr("sources.yandex_games._bootstrap_playwright_context", fake_bootstrap_playwright_context)
    monkeypatch.setattr("sources.yandex_games._fetch_reviews_page", fake_fetch_reviews_page)

    payload = asyncio.run(fetch_yandex_games_reviews("https://yandex.ru/games/app/423744", country="ru"))

    assert calls == ["xhr", "playwright"]
    assert payload["app_name"] == "Firestone"
    assert [item["review_id"] for item in payload["reviews"]] == ["rev-1"]


def test_fetch_yandex_games_reviews_retries_transient_bootstrap_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0

    async def fake_bootstrap_xhr_context(app_id: str, country: str) -> dict[str, str]:
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise TimeoutError("temporary network issue")
        return {"app_id": app_id, "country": country, "app_name": "Sample"}

    async def fake_fetch_reviews_page(context: dict[str, str], page_token: Optional[str] = None) -> dict[str, object]:
        assert page_token is None
        return {"reviews": [], "nextPageToken": None}

    monkeypatch.setattr("sources.yandex_games._bootstrap_xhr_context", fake_bootstrap_xhr_context)
    monkeypatch.setattr("sources.yandex_games._fetch_reviews_page", fake_fetch_reviews_page)

    payload = asyncio.run(fetch_yandex_games_reviews("https://yandex.ru/games/app/423744", country="ru"))

    assert attempts == 2
    assert payload["app_id"] == "423744"


def test_fetch_yandex_games_reviews_does_not_retry_value_error(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0

    async def fake_bootstrap_xhr_context(app_id: str, country: str) -> dict[str, str]:
        nonlocal attempts
        attempts += 1
        raise ValueError("schema mismatch")

    monkeypatch.setattr("sources.yandex_games._bootstrap_xhr_context", fake_bootstrap_xhr_context)

    with pytest.raises(ValueError, match="schema mismatch"):
        asyncio.run(fetch_yandex_games_reviews("https://yandex.ru/games/app/423744", country="ru"))

    assert attempts == 1


def test_bootstrap_xhr_context_extracts_app_id_from_page_html(monkeypatch: pytest.MonkeyPatch) -> None:
    html = """
    <html>
      <script>
        window.__INITIAL_STATE__ = {"game":{"id":"423744","title":"Sample Yandex Game"}};
      </script>
    </html>
    """

    class FakeResponse:
        status_code = 200
        text = html

    def fake_get_page(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    context = asyncio.run(_bootstrap_xhr_context("423744", "ru"))

    assert context["app_id"] == "423744"
    assert context["app_name"] == "Sample Yandex Game"


def test_bootstrap_xhr_context_raises_for_non_game_html(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        status_code = 200
        text = "<html><body><h1>Access denied</h1></body></html>"

    def fake_get_page(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    with pytest.raises(YandexGamesFallbackNeeded, match="bootstrap"):
        asyncio.run(_bootstrap_xhr_context("423744", "ru"))


def test_bootstrap_xhr_context_raises_for_mismatched_app_id(monkeypatch: pytest.MonkeyPatch) -> None:
    html = """
    <html>
      <script>
        window.__INITIAL_STATE__ = {"game":{"id":"999999","title":"Wrong Game"}};
      </script>
    </html>
    """

    class FakeResponse:
        status_code = 200
        text = html

    def fake_get_page(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    with pytest.raises(YandexGamesFallbackNeeded, match="423744"):
        asyncio.run(_bootstrap_xhr_context("423744", "ru"))


def test_bootstrap_xhr_context_extracts_fallback_title_from_og_meta(monkeypatch: pytest.MonkeyPatch) -> None:
    html = """
    <html>
      <head>
        <meta property="og:title" content="Firestone &amp; Friends - играть онлайн бесплатно на сервисе Яндекс Игры">
      </head>
      <body>
        <div data-app-id="423744"></div>
      </body>
    </html>
    """

    class FakeResponse:
        status_code = 200
        text = html

    def fake_get_page(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    context = asyncio.run(_bootstrap_xhr_context("423744", "ru"))

    assert context["app_name"] == "Firestone & Friends"


def test_get_playwright_page_content_uses_persistent_context_and_warmup(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    events: list[object] = []

    class FakePage:
        async def goto(self, url: str, wait_until: str, timeout: int) -> None:
            events.append(("goto", url, wait_until, timeout))

        async def wait_for_timeout(self, timeout: int) -> None:
            events.append(("wait", timeout))

        async def content(self) -> str:
            return "<html>ok</html>"

    class FakeContext:
        def __init__(self) -> None:
            self.page = FakePage()

        async def add_init_script(self, script: str) -> None:
            events.append(("init_script", "webdriver" in script))

        async def new_page(self) -> FakePage:
            events.append("new_page")
            return self.page

        async def close(self) -> None:
            events.append("context_close")

    class FakeChromium:
        async def launch_persistent_context(self, user_data_dir: str, **kwargs):
            events.append(("launch_persistent_context", user_data_dir, kwargs))
            return FakeContext()

    class FakePlaywright:
        def __init__(self) -> None:
            self.chromium = FakeChromium()

    class FakePlaywrightManager:
        async def __aenter__(self) -> FakePlaywright:
            events.append("enter_playwright")
            return FakePlaywright()

        async def __aexit__(self, exc_type, exc, tb) -> None:
            events.append("exit_playwright")

    monkeypatch.setattr("sources.yandex_games.async_playwright", lambda: FakePlaywrightManager())
    monkeypatch.setattr("sources.yandex_games._get_playwright_user_data_dir", lambda app_id: tmp_path / f"profile-{app_id}")

    html = asyncio.run(_get_playwright_page_content("https://yandex.ru/games/app/423744", country="ru"))

    assert html == "<html>ok</html>"
    launch_event = next(item for item in events if isinstance(item, tuple) and item[0] == "launch_persistent_context")
    assert launch_event[1] == str(tmp_path / "profile-423744")
    goto_urls = [item[1] for item in events if isinstance(item, tuple) and item[0] == "goto"]
    assert goto_urls == [
        "https://yandex.ru/",
        "https://yandex.ru/games/",
        "https://yandex.ru/games/app/423744",
    ]


def test_get_playwright_browser_launch_kwargs_prefers_env_executable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLAYWRIGHT_BROWSER_EXECUTABLE", "/usr/bin/chromium")

    kwargs = _get_playwright_browser_launch_kwargs()

    assert kwargs == {"executable_path": "/usr/bin/chromium"}


def test_fetch_reviews_page_uses_offset_pagination(monkeypatch: pytest.MonkeyPatch) -> None:
    requested_urls: list[str] = []

    class FakeResponse:
        status_code = 200

        def __init__(self, payload: dict[str, object]) -> None:
            self.text = json.dumps(payload)

    def fake_get_page(url: str, *, country: str):
        requested_urls.append(url)
        assert country == "ru"
        return FakeResponse(
            {
                "digest": {
                    "reviews": [
                        {
                            "id": f"rev-{index}",
                            "time": 1773119600016 + index,
                            "rating": {"val": 2, "max": 5},
                            "text": f"Loaded from digest {index}",
                            "textLanguage": "RU",
                        }
                        for index in range(10, 20)
                    ],
                    "pager": {
                        "totalCount": 89,
                        "realCount": 89,
                    },
                }
            }
        )

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    page = asyncio.run(
        __import__("sources.yandex_games", fromlist=["_fetch_reviews_page"])._fetch_reviews_page(
            {
                "digest_url": "https://yandex.ru/ugcpub/object-digest?app_id=yandex-games&otype=Soft&object=%2Fontoid%2Fygs423744&json=1&show_rating=1&view=games&theme=dark",
                "country": "ru",
            },
            page_token="10",
        )
    )

    assert requested_urls == [
        "https://yandex.ru/ugcpub/object-digest?app_id=yandex-games&otype=Soft&object=%2Fontoid%2Fygs423744&json=1&show_rating=1&view=games&theme=dark&offset=10"
    ]
    assert page["totalCount"] == 89
    assert page["nextPageToken"] == "20"
    assert page["reviews"][0]["id"] == "rev-10"


def test_fetch_reviews_page_stops_when_all_reviews_loaded(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        status_code = 200
        text = json.dumps(
            {
                "digest": {
                    "reviews": [
                        {
                            "id": "rev-last",
                            "time": 1773119600016,
                            "rating": {"val": 5, "max": 5},
                            "text": "Last page",
                            "textLanguage": "RU",
                        }
                    ],
                    "pager": {
                        "totalCount": 11,
                        "realCount": 11,
                    },
                }
            }
        )

    def fake_get_page(url: str, *, country: str):
        assert url.endswith("&offset=10")
        assert country == "ru"
        return FakeResponse()

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    page = asyncio.run(
        __import__("sources.yandex_games", fromlist=["_fetch_reviews_page"])._fetch_reviews_page(
            {
                "digest_url": "https://yandex.ru/ugcpub/object-digest?app_id=yandex-games&otype=Soft&object=%2Fontoid%2Fygs423744&json=1&show_rating=1&view=games&theme=dark",
                "country": "ru",
            },
            page_token="10",
        )
    )

    assert page["nextPageToken"] is None


def test_fetch_reviews_page_raises_for_invalid_digest_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResponse:
        status_code = 200
        text = json.dumps({"digest": {"reviews": "bad-shape"}})

    def fake_get_page(url: str, *, country: str):
        assert country == "ru"
        return FakeResponse()

    monkeypatch.setattr("sources.yandex_games._get_impersonated_page", fake_get_page)

    with pytest.raises(YandexGamesFallbackNeeded, match="digest"):
        asyncio.run(
            __import__("sources.yandex_games", fromlist=["_fetch_reviews_page"])._fetch_reviews_page(
                {
                    "digest_url": "https://yandex.ru/ugcpub/object-digest?app_id=yandex-games&otype=Soft&object=%2Fontoid%2Fygs423744&json=1&show_rating=1&view=games&theme=dark",
                    "country": "ru",
                }
            )
        )
