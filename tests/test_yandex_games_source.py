from __future__ import annotations

from sources.yandex_games import (
    extract_yandex_games_app_id,
    normalize_yandex_games_review,
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
