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
