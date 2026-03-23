from __future__ import annotations

import asyncio
import json
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


def test_generate_multi_source_dashboard_aggregates_steam_source(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    async def fake_fetch_source_payload(*, source_request: dict[str, object], progress_callback=None):
        store = source_request["store"]
        return {
            "store": store,
            "package_name": "4011110" if store == "steam" else f"pkg-{store}",
            "app_name": "Pirate Ships" if store == "steam" else f"App {store}",
            "fetch_langs": ["ru"],
            "fetch_countries": ["ru"],
            "normalized_country": "ru",
            "app_metadata": {"score": 66} if store == "steam" else {"score": 8},
            "fetched_at": "2026-03-23T00:00:00+00:00",
            "reviews": [
                {
                    "review_id": f"{store}-1",
                    "date": "2026-03-21T00:00:00+00:00",
                    "rating": 1 if store == "steam" else 5,
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
                "run_id": "run-multi-steam",
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
                    "store": "steam",
                    "url": "https://store.steampowered.com/app/4011110/Pirate_Ships/",
                    "country": "ru",
                    "period": "14d",
                    "langs": "ru",
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

    assert {review["source"] for review in calls["pipeline_kwargs"]["reviews"]} == {"steam", "vk_play"}
    assert calls["artifact_kwargs"]["artifact"]["stores_requested"] == ["steam", "vk_play"]
    assert calls["artifact_kwargs"]["artifact"]["stores_succeeded"] == ["steam", "vk_play"]
    assert result["run_id"] == "run-multi-steam"


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


def test_generate_multi_source_dashboard_resolves_mixed_windows_to_custom(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    async def fake_fetch_source_payload(*, source_request: dict[str, object], progress_callback=None):
        store = str(source_request["store"])
        if store == "google_play":
            window_from = server.datetime.fromisoformat("2026-03-01T00:00:00+00:00")
            window_to = server.datetime.fromisoformat("2026-03-07T23:59:59+00:00")
        else:
            window_from = server.datetime.fromisoformat("2026-03-10T00:00:00+00:00")
            window_to = server.datetime.fromisoformat("2026-03-20T23:59:59+00:00")
        return {
            "store": store,
            "package_name": f"pkg-{store}",
            "app_name": f"App {store}",
            "fetch_langs": ["ru"],
            "fetch_countries": ["ru"],
            "normalized_country": "ru",
            "app_metadata": {},
            "fetched_at": "2026-03-22T00:00:00+00:00",
            "reviews": [
                {
                    "review_id": f"{store}-1",
                    "date": "2026-03-21T00:00:00+00:00",
                    "rating": 5,
                    "text": f"Review from {store}",
                }
            ],
            "window_mode": "custom",
            "window_from": window_from,
            "window_to": window_to,
        }

    async def fake_run_pipeline_and_build_report(**kwargs):
        calls["pipeline_kwargs"] = kwargs
        return (
            {
                "run_id": "run-mixed-window",
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
                {"store": "google_play", "url": "https://play.google.com/store/apps/details?id=com.example", "country": "us", "period": "custom", "from": "2026-03-01", "to": "2026-03-07", "langs": "en,ru"},
                {"store": "yandex_games", "url": "https://yandex.ru/games/app/423744", "country": "ru", "period": "custom", "from": "2026-03-10", "to": "2026-03-20"},
            ],
            progress_callback=None,
        )
    )

    assert calls["pipeline_kwargs"]["window_mode"] == "custom"
    assert calls["pipeline_kwargs"]["window_from"].isoformat() == "2026-03-01T00:00:00+00:00"
    assert calls["pipeline_kwargs"]["window_to"].isoformat() == "2026-03-20T23:59:59+00:00"
    assert calls["artifact_kwargs"]["artifact"]["window_mode"] == "custom"
    assert result["window_mode"] == "custom"


def test_generate_multi_source_dashboard_saves_json_serializable_source_payloads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch_source_payload(*, source_request: dict[str, object], progress_callback=None):
        return {
            "store": "vk_play",
            "package_name": "46035",
            "app_name": "Pirate Ships",
            "fetch_langs": ["ru"],
            "fetch_countries": ["ru"],
            "normalized_country": "ru",
            "app_metadata": {},
            "fetched_at": "2026-03-22T00:00:00+00:00",
            "reviews": [
                {
                    "review_id": "vk-1",
                    "date": "2026-03-21T00:00:00+00:00",
                    "rating": 5,
                    "text": "Review from vk_play",
                }
            ],
            "window_mode": "custom",
            "window_from": server.datetime.fromisoformat("2026-03-01T00:00:00+00:00"),
            "window_to": server.datetime.fromisoformat("2026-03-20T23:59:59+00:00"),
        }

    async def fake_run_pipeline_and_build_report(**kwargs):
        return (
            {
                "run_id": "run-serializable",
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
        json.dumps(kwargs["artifact"])
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

    asyncio.run(
        server._generate_multi_source_dashboard(
            sources=[
                {
                    "store": "vk_play",
                    "url": "https://vkplay.ru/play/game/pirate-ships-46035",
                    "country": "ru",
                    "period": "custom",
                    "from": "2026-03-01",
                    "to": "2026-03-20",
                    "langs": "ru",
                }
            ],
            progress_callback=None,
        )
    )
