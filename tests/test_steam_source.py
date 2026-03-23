from __future__ import annotations

import asyncio

import pytest

from sources.steam import SteamScraperError, extract_steam_app_id, fetch_steam_reviews, normalize_steam_review


def test_extract_steam_app_id_accepts_direct_game_url() -> None:
    assert extract_steam_app_id("https://store.steampowered.com/app/4011110/Pirate_Ships/") == "4011110"


def test_extract_steam_app_id_rejects_non_app_url() -> None:
    with pytest.raises(ValueError, match="Steam"):
        extract_steam_app_id("https://store.steampowered.com/search/?term=pirate+ships")


def test_normalize_steam_review_maps_payload_to_internal_shape() -> None:
    payload = normalize_steam_review(
        {
            "recommendationid": "221390767",
            "review": "Мобильная фигня.",
            "language": "russian",
            "timestamp_created": 1773977596,
            "voted_up": False,
            "votes_up": 3,
            "comment_count": 1,
            "steam_purchase": True,
            "received_for_free": False,
            "author": {
                "steamid": "76561198973965900",
                "personaname": "Kpylllka_KBaca",
                "playtime_at_review": 543,
            },
        }
    )

    assert payload == {
        "review_id": "221390767",
        "date": "2026-03-20T03:33:16+00:00",
        "rating": 1,
        "text": "Мобильная фигня.",
        "version": None,
        "thumbs_up": 3,
        "original_lang": "ru",
        "lang": "ru",
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
        "author_name": "Kpylllka_KBaca",
        "author_id": "76561198973965900",
        "playtime_minutes": 543,
        "comment_count": 1,
        "steam_purchase": True,
        "received_for_free": False,
    }


def test_fetch_steam_reviews_follows_cursor_pagination(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    async def fake_fetch_app_details(app_id: str, lang: str) -> dict[str, object]:
        assert app_id == "4011110"
        assert lang == "russian"
        return {
            "app_name": "Pirate Ships",
            "app_metadata": {
                "app_name": "Pirate Ships",
                "version": None,
                "recent_changes": "",
                "last_updated_on": "",
                "score": 66,
                "ratings": 227,
                "histogram": [],
            },
        }

    async def fake_fetch_reviews_page(*, app_id: str, language: str, cursor: str, num_per_page: int) -> dict[str, object]:
        calls.append(cursor)
        assert app_id == "4011110"
        assert language == "russian"
        assert num_per_page == 100
        if cursor == "*":
            return {
                "success": 1,
                "reviews": [
                    {
                        "recommendationid": "1",
                        "review": "A",
                        "language": "russian",
                        "timestamp_created": 1773977596,
                        "voted_up": False,
                        "votes_up": 0,
                        "comment_count": 0,
                        "steam_purchase": True,
                        "received_for_free": False,
                        "author": {"steamid": "10", "personaname": "one", "playtime_at_review": 10},
                    }
                ],
                "cursor": "cursor-2",
            }
        return {
            "success": 1,
            "reviews": [
                {
                    "recommendationid": "2",
                    "review": "B",
                    "language": "russian",
                    "timestamp_created": 1773977597,
                    "voted_up": True,
                    "votes_up": 2,
                    "comment_count": 0,
                    "steam_purchase": True,
                    "received_for_free": False,
                    "author": {"steamid": "11", "personaname": "two", "playtime_at_review": 20},
                }
            ],
            "cursor": "cursor-3",
        }

    monkeypatch.setattr("sources.steam._fetch_steam_app_details", fake_fetch_app_details)
    monkeypatch.setattr("sources.steam._fetch_steam_reviews_page", fake_fetch_reviews_page)

    payload = asyncio.run(
        fetch_steam_reviews("https://store.steampowered.com/app/4011110/Pirate_Ships/", max_reviews=2, lang="ru")
    )

    assert calls == ["*", "cursor-2"]
    assert payload["app_id"] == "4011110"
    assert payload["app_name"] == "Pirate Ships"
    assert [item["review_id"] for item in payload["reviews"]] == ["1", "2"]


def test_fetch_steam_reviews_raises_for_invalid_reviews_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_app_details(app_id: str, lang: str) -> dict[str, object]:
        return {
            "app_name": "Pirate Ships",
            "app_metadata": {"app_name": "Pirate Ships"},
        }

    async def fake_fetch_reviews_page(*, app_id: str, language: str, cursor: str, num_per_page: int) -> dict[str, object]:
        return {"success": 1, "cursor": "next-only"}

    monkeypatch.setattr("sources.steam._fetch_steam_app_details", fake_fetch_app_details)
    monkeypatch.setattr("sources.steam._fetch_steam_reviews_page", fake_fetch_reviews_page)

    with pytest.raises(SteamScraperError, match="reviews"):
        asyncio.run(fetch_steam_reviews("https://store.steampowered.com/app/4011110/Pirate_Ships/", lang="ru"))
