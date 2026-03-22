from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

import server


def test_generate_multi_source_dashboard_aggregates_successful_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    async def fake_fetch_source_payload(*, source_request: dict[str, object], progress_callback=None):
        store = source_request["store"]
        if progress_callback:
            await progress_callback({"type": "status", "step": f"fetching:{store}"})
        return {
            "store": store,
            "package_name": f"pkg-{store}",
            "app_name": f"App {store}",
            "fetch_langs": ["ru"],
            "fetch_countries": ["ru"],
            "normalized_country": "ru",
            "app_metadata": {"score": 8},
            "fetched_at": "2026-03-22T00:00:00+00:00",
            "reviews": [
                {
                    "review_id": f"{store}-1",
                    "date": "2026-03-21T00:00:00+00:00",
                    "rating": 5,
                    "text": f"Review from {store}",
                    "lang": "ru",
                    "original_lang": "ru",
                    "thumbs_up": 0,
                    "version": None,
                    "has_reply": False,
                    "reply_text": None,
                    "reply_date": None,
                }
            ],
            "window_mode": "14d",
            "window_from": None,
            "window_to": None,
        }

    async def fake_run_pipeline_and_build_report(**kwargs):
        calls["pipeline_kwargs"] = kwargs
        return (
            {
                "run_id": "run-multi",
                "themes": [],
                "classified": [],
                "alerts": [],
                "stats": {},
                "category_counts": {},
                "synthesis_markdown": "",
                "report_layers": {},
                "model": "test",
                "prompt_versions": {},
            },
            "# Combined Report",
            Path("/tmp/report.md"),
            {"version": "1.0.0"},
            None,
        )

    def fake_save_run_artifact(**kwargs):
        calls["artifact_kwargs"] = kwargs
        return "/tmp/run.json"

    monkeypatch.setattr(server, "_fetch_source_payload", fake_fetch_source_payload)
    monkeypatch.setattr(server, "_run_pipeline_and_build_report", fake_run_pipeline_and_build_report)
    monkeypatch.setattr(server, "save_run_artifact", fake_save_run_artifact)
    monkeypatch.setattr(server, "update_version_history", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "get_current_version", lambda package_name: {"version": "1.0.0"})
    monkeypatch.setattr(server, "get_previous_version", lambda package_name: None)
    monkeypatch.setattr(server, "load_dashboard_config", lambda *args, **kwargs: {})
    monkeypatch.setattr(server, "log_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "update_current_trace", lambda *args, **kwargs: None)

    result = asyncio.run(
        server._generate_multi_source_dashboard(
            sources=[
                {
                    "store": "google_play",
                    "url": "https://play.google.com/store/apps/details?id=com.example",
                    "country": "us",
                    "period": "14d",
                    "langs": "en,ru",
                },
                {
                    "store": "vk_play",
                    "url": "https://vkplay.ru/play/game/pirate-ships-46035",
                    "country": "ru",
                    "period": "14d",
                    "langs": "ru",
                },
            ],
            progress_callback=None,
        )
    )

    reviews = calls["pipeline_kwargs"]["reviews"]
    assert len(reviews) == 2
    assert {review["source"] for review in reviews} == {"google_play", "vk_play"}
    assert calls["artifact_kwargs"]["artifact"]["store"] == "multi_source"
    assert calls["artifact_kwargs"]["artifact"]["stores_requested"] == ["google_play", "vk_play"]
    assert calls["artifact_kwargs"]["artifact"]["stores_succeeded"] == ["google_play", "vk_play"]
    assert calls["artifact_kwargs"]["artifact"]["stores_failed"] == []
    assert result["run_id"] == "run-multi"


def test_generate_multi_source_dashboard_continues_after_one_source_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    async def fake_fetch_source_payload(*, source_request: dict[str, object], progress_callback=None):
        store = source_request["store"]
        if store == "yandex_games":
            raise RuntimeError("captcha")
        return {
            "store": store,
            "package_name": f"pkg-{store}",
            "app_name": f"App {store}",
            "fetch_langs": ["ru"],
            "fetch_countries": ["ru"],
            "normalized_country": "ru",
            "app_metadata": {"score": 8},
            "fetched_at": "2026-03-22T00:00:00+00:00",
            "reviews": [
                {
                    "review_id": f"{store}-1",
                    "date": "2026-03-21T00:00:00+00:00",
                    "rating": 5,
                    "text": f"Review from {store}",
                    "lang": "ru",
                    "original_lang": "ru",
                    "thumbs_up": 0,
                    "version": None,
                    "has_reply": False,
                    "reply_text": None,
                    "reply_date": None,
                }
            ],
            "window_mode": "14d",
            "window_from": None,
            "window_to": None,
        }

    async def fake_run_pipeline_and_build_report(**kwargs):
        calls["pipeline_kwargs"] = kwargs
        return (
            {
                "run_id": "run-partial",
                "themes": [],
                "classified": [],
                "alerts": [],
                "stats": {},
                "category_counts": {},
                "synthesis_markdown": "",
                "report_layers": {},
                "model": "test",
                "prompt_versions": {},
            },
            "# Combined Report",
            Path("/tmp/report.md"),
            {"version": "1.0.0"},
            None,
        )

    def fake_save_run_artifact(**kwargs):
        calls["artifact_kwargs"] = kwargs
        return "/tmp/run.json"

    monkeypatch.setattr(server, "_fetch_source_payload", fake_fetch_source_payload)
    monkeypatch.setattr(server, "_run_pipeline_and_build_report", fake_run_pipeline_and_build_report)
    monkeypatch.setattr(server, "save_run_artifact", fake_save_run_artifact)
    monkeypatch.setattr(server, "update_version_history", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "get_current_version", lambda package_name: {"version": "1.0.0"})
    monkeypatch.setattr(server, "get_previous_version", lambda package_name: None)
    monkeypatch.setattr(server, "load_dashboard_config", lambda *args, **kwargs: {})
    monkeypatch.setattr(server, "log_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "update_current_trace", lambda *args, **kwargs: None)

    result = asyncio.run(
        server._generate_multi_source_dashboard(
            sources=[
                {"store": "google_play", "url": "https://play.google.com/store/apps/details?id=com.example", "country": "us", "period": "14d", "langs": "en,ru"},
                {"store": "yandex_games", "url": "https://yandex.ru/games/app/423744", "country": "ru", "period": "14d"},
            ],
            progress_callback=None,
        )
    )

    assert len(calls["pipeline_kwargs"]["reviews"]) == 1
    assert calls["artifact_kwargs"]["artifact"]["stores_succeeded"] == ["google_play"]
    assert calls["artifact_kwargs"]["artifact"]["stores_failed"] == ["yandex_games"]
    assert calls["artifact_kwargs"]["artifact"]["source_errors"] == [{"store": "yandex_games", "detail": "captcha"}]
    assert result["run_id"] == "run-partial"


def test_generate_multi_source_dashboard_fails_when_all_sources_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch_source_payload(*, source_request: dict[str, object], progress_callback=None):
        raise RuntimeError(f"boom:{source_request['store']}")

    monkeypatch.setattr(server, "_fetch_source_payload", fake_fetch_source_payload)

    with pytest.raises(LookupError, match="All selected stores failed"):
        asyncio.run(
            server._generate_multi_source_dashboard(
                sources=[
                    {"store": "google_play", "url": "https://play.google.com/store/apps/details?id=com.example", "country": "us", "period": "14d", "langs": "en,ru"},
                    {"store": "yandex_games", "url": "https://yandex.ru/games/app/423744", "country": "ru", "period": "14d"},
                ],
                progress_callback=None,
            )
        )
