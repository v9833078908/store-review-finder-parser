from __future__ import annotations

from sources.app_store import (
    APP_STORE_MAX_REVIEWS,
    _normalize_review_entry,
    build_customer_reviews_url,
    clamp_max_reviews,
    validate_app_store_id,
)


def test_validate_app_store_id_accepts_numeric_id() -> None:
    assert validate_app_store_id("123456789") == "123456789"


def test_validate_app_store_id_rejects_non_numeric_value() -> None:
    try:
        validate_app_store_id("id123456789")
    except ValueError as exc:
        assert "numeric" in str(exc)
    else:
        raise AssertionError("Expected ValueError for non-numeric app id")


def test_build_customer_reviews_url_uses_country_page_and_app_id() -> None:
    url = build_customer_reviews_url(country="us", app_id="123456789", page=3)

    assert url == "https://itunes.apple.com/us/rss/customerreviews/page=3/id=123456789/sortby=mostrecent/json"


def test_normalize_review_entry_maps_app_store_payload_to_internal_shape() -> None:
    review = _normalize_review_entry(
        {
            "id": {"label": "987654321"},
            "updated": {"label": "2026-03-10T10:15:00-07:00"},
            "im:rating": {"label": "4"},
            "content": {"label": "Great game, but crashes sometimes"},
            "im:version": {"label": "1.2.3"},
            "author": {"name": {"label": "TestUser"}},
        },
        default_lang="en",
    )

    assert review == {
        "review_id": "987654321",
        "date": "2026-03-10T17:15:00+00:00",
        "rating": 4,
        "text": "Great game, but crashes sometimes",
        "version": "1.2.3",
        "thumbs_up": 0,
        "original_lang": "en",
        "lang": "en",
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }


def test_clamp_max_reviews_caps_to_app_store_limit() -> None:
    assert clamp_max_reviews(999) == APP_STORE_MAX_REVIEWS
    assert clamp_max_reviews(50) == 50
