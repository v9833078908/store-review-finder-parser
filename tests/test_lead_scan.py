from __future__ import annotations

from datetime import datetime, timedelta

from lead_scan import analyze_reviews, calculate_lead_score, resolve_google_play_input
import lead_scan


def test_analyze_reviews_metrics() -> None:
    now = datetime.now()
    reviews = [
        {"date": now - timedelta(days=1), "score": 1, "replyDate": None},
        {"date": now - timedelta(days=2), "score": 2, "replyDate": now - timedelta(days=1)},
        {"date": now - timedelta(days=3), "score": 5, "replyDate": None},
    ]

    metrics = analyze_reviews(reviews, window_days=30, min_age_days=0)

    assert metrics["sample_size"] == 3
    assert metrics["no_reply_rate"] == 66.7
    assert metrics["no_reply_rate_neg"] == 50.0
    assert metrics["unanswered_neg_30d"] == 1


def test_calculate_lead_score_returns_int() -> None:
    analysis = {
        "no_reply_rate": 90.0,
        "no_reply_rate_neg": 80.0,
        "unanswered_neg_30d": 6,
    }
    app_details = {
        "reviews": 25000,
        "score": 3.7,
    }

    score = calculate_lead_score(analysis, app_details)

    assert isinstance(score, int)
    assert 0 <= score <= 100


def test_resolve_google_play_input_empty() -> None:
    try:
        resolve_google_play_input("")
        assert False, "Expected ValueError for empty input"
    except ValueError:
        assert True


def test_resolve_google_play_search_uses_bridge_candidates(monkeypatch) -> None:
    def fake_run_bridge(payload):
        if payload.get("mode") == "search":
            return {
                "items": [
                    {
                        "appId": "com.herocraft.game.piratearena",
                        "title": "Pirate Ships・Build and Fight",
                        "url": "https://play.google.com/store/apps/details?id=com.herocraft.game.piratearena",
                        "score": 4.7,
                        "reviews": "1,000,000+",
                    },
                    {
                        "appId": "com.seaofconquest.global",
                        "title": "Sea of Conquest: Pirate War",
                        "url": "https://play.google.com/store/apps/details?id=com.seaofconquest.global",
                    },
                ]
            }
        raise AssertionError(f"Unexpected bridge payload: {payload}")

    def fail_python_search(*args, **kwargs):
        raise AssertionError("Python search fallback should not be used when bridge has results")

    monkeypatch.setattr(lead_scan, "_run_bridge", fake_run_bridge)
    monkeypatch.setattr(lead_scan, "gp_search", fail_python_search)

    result = resolve_google_play_input(
        "https://play.google.com/store/search?q=pirate+ships&c=apps&hl=en&gl=us",
        country="us",
        lang="en",
        limit=5,
    )

    assert result["recommended_app_id"] == "com.herocraft.game.piratearena"
    assert result["candidates"][0]["title"] == "Pirate Ships・Build and Fight"
    assert result["candidates"][0]["is_top1"] is True
