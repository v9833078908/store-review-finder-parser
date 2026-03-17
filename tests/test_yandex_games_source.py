from __future__ import annotations

import asyncio
from typing import Optional

import pytest

from sources.yandex_games import (
    extract_yandex_games_app_id,
    fetch_yandex_games_reviews,
    _bootstrap_xhr_context,
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

    monkeypatch.setattr("sources.yandex_games._bootstrap_xhr_context", fake_bootstrap_xhr_context)

    with pytest.raises(YandexGamesFallbackNeeded, match="bootstrap failed"):
        asyncio.run(fetch_yandex_games_reviews("https://yandex.ru/games/app/423744", country="ru"))


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
