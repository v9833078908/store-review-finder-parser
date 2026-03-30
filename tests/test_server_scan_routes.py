from __future__ import annotations

from fastapi.testclient import TestClient

import server


def _sample_row() -> dict:
    return {
        "developer": "Dev Studio",
        "title": "Sample Game",
        "url": "https://play.google.com/store/apps/details?id=com.sample.game",
        "no_reply_rate": 50.0,
        "no_reply_rate_neg": 65.0,
        "unanswered_neg_30d": 4,
        "lead_score": 72,
        "appId": "com.sample.game",
        "developerEmail": "team@sample.dev",
        "score": 3.9,
        "total_reviews_count": 12000,
        "sample_size": 200,
    }


def test_scan_sync_contract(monkeypatch) -> None:
    def fake_run_catalog_scan(params, progress_callback=None):
        return [_sample_row()], 0

    monkeypatch.setattr(server, "run_catalog_scan", fake_run_catalog_scan)

    client = TestClient(server.app)
    response = client.get(
        "/api/scan/sync",
        params={
            "collection": "TOP_FREE",
            "category": "GAME",
            "country": "us",
            "lang": "en",
            "maxApps": 1,
            "maxReviews": 50,
            "windowDays": 365,
            "minAgeDays": 0,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["totalProcessed"] == 1
    assert payload["totalErrors"] == 0
    assert payload["results"][0]["appId"] == "com.sample.game"


def test_resolve_google_play_contract(monkeypatch) -> None:
    def fake_resolve_google_play_input(input_value: str, country: str, lang: str, limit: int):
        assert input_value
        return {
            "input_type": "search_url",
            "recommended_app_id": "com.sample.game",
            "candidates": [
                {
                    "app_id": "com.sample.game",
                    "title": "Sample Game",
                    "url": "https://play.google.com/store/apps/details?id=com.sample.game",
                    "score": 4.2,
                    "reviews_count": 10000,
                    "is_top1": True,
                }
            ],
        }

    monkeypatch.setattr(server, "resolve_google_play_input", fake_resolve_google_play_input)

    client = TestClient(server.app)
    response = client.get(
        "/api/resolve/google-play",
        params={"input": "https://play.google.com/store/search?q=sample&c=apps"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommended_app_id"] == "com.sample.game"
    assert payload["candidates"][0]["is_top1"] is True


def test_resolve_app_store_contract(monkeypatch) -> None:
    async def fake_resolve_app_store_input(app_id: str, country: str):
        assert app_id == "123456789"
        assert country == "us"
        return {
            "input_type": "app_store_id",
            "recommended_app_id": "123456789",
            "candidates": [
                {
                    "app_id": "123456789",
                    "title": "Sample iOS Game",
                    "url": "https://apps.apple.com/app/id123456789",
                    "score": 4.7,
                    "reviews_count": 42000,
                    "is_top1": True,
                }
            ],
        }

    monkeypatch.setattr(server, "resolve_app_store_input", fake_resolve_app_store_input, raising=False)

    client = TestClient(server.app)
    response = client.get(
        "/api/resolve/app-store",
        params={"app_id": "123456789", "country": "us"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommended_app_id"] == "123456789"
    assert payload["candidates"][0]["title"] == "Sample iOS Game"


def test_resolve_app_store_rejects_non_numeric_input() -> None:
    client = TestClient(server.app)
    response = client.get(
        "/api/resolve/app-store",
        params={"app_id": "id123456789", "country": "us"},
    )

    assert response.status_code == 422
    payload = response.json()
    assert "numeric" in payload["detail"]


def test_resolve_app_store_accepts_full_url(monkeypatch) -> None:
    async def fake_resolve_app_store_input(app_id: str, country: str):
        assert app_id == "https://apps.apple.com/ua/app/pirate-ships-build-and-fight/id1538178771?l=ru"
        assert country == "ua"
        return {
            "input_type": "app_store_id",
            "recommended_app_id": "1538178771",
            "candidates": [
                {
                    "app_id": "1538178771",
                    "title": "Pirate Ships: Build and Fight",
                    "url": "https://apps.apple.com/app/id1538178771",
                    "score": 4.7,
                    "reviews_count": 42000,
                    "is_top1": True,
                }
            ],
        }

    monkeypatch.setattr(server, "resolve_app_store_input", fake_resolve_app_store_input, raising=False)

    client = TestClient(server.app)
    response = client.get(
        "/api/resolve/app-store",
        params={
            "app_id": "https://apps.apple.com/ua/app/pirate-ships-build-and-fight/id1538178771?l=ru",
            "country": "ua",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommended_app_id"] == "1538178771"
