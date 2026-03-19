from __future__ import annotations

import asyncio

import pytest

from sources.vk_play import (
    VKPlayScraperError,
    _map_vk_play_lang,
    extract_vk_play_slug,
    fetch_vk_play_reviews,
    normalize_vk_play_review,
)


def test_extract_vk_play_slug_accepts_direct_game_url() -> None:
    assert extract_vk_play_slug("https://vkplay.ru/play/game/pirate-ships-46035") == "pirate-ships-46035"


def test_extract_vk_play_slug_rejects_non_game_url() -> None:
    with pytest.raises(ValueError, match="VK Play"):
        extract_vk_play_slug("https://vkplay.ru/play")


def test_map_vk_play_lang_supports_ru_and_en_with_fallback() -> None:
    assert _map_vk_play_lang("ru") == "ru_RU"
    assert _map_vk_play_lang("en") == "en_US"
    assert _map_vk_play_lang("de") == "ru_RU"


def test_normalize_vk_play_review_maps_payload_to_internal_shape() -> None:
    payload = normalize_vk_play_review(
        {
            "id": 336145,
            "text": "Хорошая игра.",
            "date_added": "2026-03-12 19:28:00",
            "likes": 7,
            "dislikes": 1,
            "lang": "ru_RU",
            "rating": 10.0,
            "author": {"nick": "sergey_boytsov", "time_spend": 51663},
        }
    )

    assert payload == {
        "review_id": "336145",
        "date": "2026-03-12T19:28:00+00:00",
        "rating": 10,
        "text": "Хорошая игра.",
        "version": None,
        "thumbs_up": 7,
        "original_lang": "ru",
        "lang": "ru",
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
        "author_name": "sergey_boytsov",
        "playtime_seconds": 51663,
    }


def test_fetch_vk_play_reviews_follows_next_cursor(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str | None] = []

    async def fake_fetch_catalog(slug: str, lang: str) -> dict[str, object]:
        assert slug == "pirate-ships-46035"
        assert lang == "ru_RU"
        return {
            "id": 46035,
            "name": "Pirate Ships",
            "avgRating": 7.9,
            "reviewsCount": 170,
        }

    async def fake_fetch_reviews_page(*, game_id: int, lang: str, next_url: str | None, limit: int) -> dict[str, object]:
        calls.append(next_url)
        assert game_id == 46035
        assert lang == "ru_RU"
        assert limit == 50
        if next_url is None:
            return {
                "results": [
                    {
                        "id": 1,
                        "text": "A",
                        "date_added": "2026-03-16 10:00:00",
                        "likes": 0,
                        "lang": "ru_RU",
                        "rating": 10.0,
                        "author": {"nick": "one", "time_spend": 10},
                    }
                ],
                "next": "https://api.vkplay.ru/play/microreviews_v2/?cursor=123",
            }
        return {
            "results": [
                {
                    "id": 2,
                    "text": "B",
                    "date_added": "2026-03-15 10:00:00",
                    "likes": 1,
                    "lang": "ru_RU",
                    "rating": 9.0,
                    "author": {"nick": "two", "time_spend": 20},
                }
            ],
            "next": None,
        }

    monkeypatch.setattr("sources.vk_play._fetch_vk_play_catalog", fake_fetch_catalog)
    monkeypatch.setattr("sources.vk_play._fetch_vk_play_reviews_page", fake_fetch_reviews_page)

    payload = asyncio.run(fetch_vk_play_reviews("https://vkplay.ru/play/game/pirate-ships-46035", max_reviews=100, lang="ru"))

    assert calls == [None, "https://api.vkplay.ru/play/microreviews_v2/?cursor=123"]
    assert payload["app_id"] == "46035"
    assert payload["app_name"] == "Pirate Ships"
    assert [item["review_id"] for item in payload["reviews"]] == ["1", "2"]


def test_fetch_vk_play_reviews_raises_for_invalid_catalog_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_catalog(slug: str, lang: str) -> dict[str, object]:
        return {"name": "Pirate Ships"}

    monkeypatch.setattr("sources.vk_play._fetch_vk_play_catalog", fake_fetch_catalog)

    with pytest.raises(VKPlayScraperError, match="catalog"):
        asyncio.run(fetch_vk_play_reviews("https://vkplay.ru/play/game/pirate-ships-46035", lang="ru"))


def test_fetch_vk_play_reviews_raises_for_invalid_reviews_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_catalog(slug: str, lang: str) -> dict[str, object]:
        return {
            "id": 46035,
            "name": "Pirate Ships",
            "avgRating": 7.9,
            "reviewsCount": 170,
        }

    async def fake_fetch_reviews_page(*, game_id: int, lang: str, next_url: str | None, limit: int) -> dict[str, object]:
        return {"next": None}

    monkeypatch.setattr("sources.vk_play._fetch_vk_play_catalog", fake_fetch_catalog)
    monkeypatch.setattr("sources.vk_play._fetch_vk_play_reviews_page", fake_fetch_reviews_page)

    with pytest.raises(VKPlayScraperError, match="reviews"):
        asyncio.run(fetch_vk_play_reviews("https://vkplay.ru/play/game/pirate-ships-46035", lang="ru"))
