from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi.testclient import TestClient

import server
from sources.yandex_games import YandexGamesFallbackNeeded


def test_report_sync_contract(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["store"] == "google_play"
        assert kwargs["source"] in {"direct_url", "catalog"}
        assert kwargs["country"] == "us"
        return {
            "run_id": "run-123",
            "package_name": "com.sample.game",
            "app_name": "Sample Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {
                "summary": {"title": "Сводка", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "signals": {"title": "Сигналы", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "issues": {"title": "Проблемы", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "actions": {"title": "Действия", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
            },
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "url": "https://play.google.com/store/apps/details?id=com.sample.game",
            "country": "us",
            "source": "catalog",
            "app_id": "com.sample.game",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-123"
    assert payload["package_name"] == "com.sample.game"
    assert "report_layers" in payload
    assert payload["markdown"] == "# Report"


def test_report_sync_contract_accepts_all_region(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["country"] == "all"
        return {
            "run_id": "run-all",
            "package_name": "com.sample.game",
            "app_name": "Sample Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {
                "summary": {"title": "Сводка", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "signals": {"title": "Сигналы", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "issues": {"title": "Проблемы", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "actions": {"title": "Действия", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
            },
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "url": "https://play.google.com/store/apps/details?id=com.sample.game",
            "country": "all",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-all"


def test_report_sync_contract_accepts_app_store(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["store"] == "app_store"
        assert kwargs["selected_app_id"] == "123456789"
        assert kwargs["country"] == "us"
        return {
            "run_id": "run-app-store",
            "package_name": "123456789",
            "app_name": "Sample iOS Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {
                "summary": {"title": "Summary", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-12T00:00:00Z"},
                "signals": {"title": "Signals", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-12T00:00:00Z"},
                "issues": {"title": "Issues", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-12T00:00:00Z"},
                "actions": {"title": "Actions", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-12T00:00:00Z"},
            },
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "store": "app_store",
            "url": "https://apps.apple.com/app/id123456789",
            "country": "us",
            "app_id": "123456789",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-app-store"
    assert payload["package_name"] == "123456789"


def test_report_sync_contract_accepts_yandex_games(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["store"] == "yandex_games"
        assert kwargs["url"] == "https://yandex.ru/games/app/423744"
        assert kwargs["country"] == "ru"
        return {
            "run_id": "run-yandex-games",
            "package_name": "423744",
            "app_name": "Sample Yandex Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {
                "summary": {"title": "Summary", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-18T00:00:00Z"},
                "signals": {"title": "Signals", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-18T00:00:00Z"},
                "issues": {"title": "Issues", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-18T00:00:00Z"},
                "actions": {"title": "Actions", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-03-18T00:00:00Z"},
            },
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "store": "yandex_games",
            "url": "https://yandex.ru/games/app/423744",
            "country": "ru",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-yandex-games"
    assert payload["package_name"] == "423744"


def test_report_sync_contract_accepts_vk_play(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["store"] == "vk_play"
        assert kwargs["url"] == "https://vkplay.ru/play/game/pirate-ships-46035"
        assert kwargs["country"] == "ru"
        assert kwargs["langs_raw"] == "ru"
        assert kwargs["period"] == "14d"
        return {
            "run_id": "run-vk-play",
            "package_name": "46035",
            "app_name": "Pirate Ships",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {},
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "store": "vk_play",
            "url": "https://vkplay.ru/play/game/pirate-ships-46035",
            "country": "ru",
            "langs": "ru",
            "period": "14d",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-vk-play"
    assert payload["package_name"] == "46035"


def test_resolve_dashboard_params_keeps_window_for_yandex_games() -> None:
    normalized_country, window_mode, window_from, window_to, fetch_langs, fetch_max_reviews, fetch_countries = (
        server._resolve_dashboard_params(
            url="https://yandex.ru/games/app/423744",
            max_reviews=300,
            langs_raw="en,ru",
            country="us",
            period="14d",
            from_date=None,
            to_date=None,
            store="yandex_games",
        )
    )

    assert normalized_country == "ru"
    assert window_mode == "14d"
    assert window_from is not None
    assert window_to is not None
    assert fetch_langs == ["ru"]
    assert fetch_max_reviews == server.WINDOW_FETCH_LIMIT
    assert fetch_countries == ["ru"]


def test_resolve_dashboard_params_keeps_window_for_vk_play() -> None:
    normalized_country, window_mode, window_from, window_to, fetch_langs, fetch_max_reviews, fetch_countries = (
        server._resolve_dashboard_params(
            url="https://vkplay.ru/play/game/pirate-ships-46035",
            max_reviews=300,
            langs_raw="ru,en",
            country="ru",
            period="14d",
            from_date=None,
            to_date=None,
            store="vk_play",
        )
    )

    assert normalized_country == "ru"
    assert window_mode == "14d"
    assert window_from is not None
    assert window_to is not None
    assert fetch_langs == ["ru", "en"]
    assert fetch_max_reviews == server.WINDOW_FETCH_LIMIT
    assert fetch_countries == ["ru"]


def test_generate_dashboard_uses_yandex_games_fetch_branch(monkeypatch) -> None:
    calls: dict[str, object] = {}

    async def fake_fetch_yandex_games_reviews(**kwargs):
        calls["fetch_kwargs"] = kwargs
        return {
            "app_id": "423744",
            "app_name": "Sample Yandex Game",
            "country": "ru",
            "reviews": [
                {
                    "review_id": "rev-1",
                    "date": "2026-03-18T00:00:00+00:00",
                    "rating": 5,
                    "text": "Nice",
                    "version": None,
                    "thumbs_up": 0,
                    "original_lang": "ru",
                    "lang": "ru",
                    "has_reply": False,
                    "reply_text": None,
                    "reply_date": None,
                }
            ],
            "app_metadata": {"recent_changes": "v1"},
            "fetched_at": "2026-03-18T00:00:00+00:00",
            "cache_hit": False,
        }

    async def fake_run_pipeline_and_build_report(**kwargs):
        calls["pipeline_kwargs"] = kwargs
        return (
            {
                "run_id": "run-yandex-branch",
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
            "# Report",
            Path("/tmp/report.md"),
            {"version": "1.0.0"},
            None,
        )

    def fake_save_run_artifact(**kwargs):
        calls["artifact_kwargs"] = kwargs
        return "/tmp/run.json"

    monkeypatch.setattr(server, "fetch_yandex_games_reviews", fake_fetch_yandex_games_reviews)
    monkeypatch.setattr(server, "_run_pipeline_and_build_report", fake_run_pipeline_and_build_report)
    monkeypatch.setattr(server, "save_run_artifact", fake_save_run_artifact)
    monkeypatch.setattr(server, "update_version_history", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "get_current_version", lambda package_name: {"version": "1.0.0"})
    monkeypatch.setattr(server, "get_previous_version", lambda package_name: None)
    monkeypatch.setattr(server, "load_dashboard_config", lambda *args, **kwargs: {})
    monkeypatch.setattr(server, "log_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "update_current_trace", lambda *args, **kwargs: None)

    result = asyncio.run(
        server._generate_dashboard(
            store="yandex_games",
            url="https://yandex.ru/games/app/423744",
            max_reviews=25,
            langs_raw="en,ru",
            country="ru",
            period=None,
            from_date=None,
            to_date=None,
            force_refresh=False,
            cache_ttl_hours=1,
            source="direct_url",
            selected_app_id=None,
        )
    )

    assert calls["fetch_kwargs"]["url"] == "https://yandex.ru/games/app/423744"
    assert calls["pipeline_kwargs"]["package_name"] == "423744"
    assert calls["pipeline_kwargs"]["app_name"] == "Sample Yandex Game"
    assert calls["artifact_kwargs"]["artifact"]["store"] == "yandex_games"
    assert result["package_name"] == "423744"


def test_generate_dashboard_uses_vk_play_fetch_branch(monkeypatch) -> None:
    calls: dict[str, object] = {}

    async def fake_fetch_vk_play_reviews(**kwargs):
        calls["fetch_kwargs"] = kwargs
        return {
            "app_id": "46035",
            "app_name": "Pirate Ships",
            "lang": "ru_RU",
            "reviews": [
                {
                    "review_id": "rev-1",
                    "date": "2026-03-18T00:00:00+00:00",
                    "rating": 10,
                    "text": "Nice",
                    "version": None,
                    "thumbs_up": 0,
                    "original_lang": "ru",
                    "lang": "ru",
                    "has_reply": False,
                    "reply_text": None,
                    "reply_date": None,
                }
            ],
            "app_metadata": {"score": 7.9},
            "fetched_at": "2026-03-19T00:00:00+00:00",
            "cache_hit": False,
        }

    async def fake_run_pipeline_and_build_report(**kwargs):
        calls["pipeline_kwargs"] = kwargs
        return (
            {
                "run_id": "run-vk-branch",
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
            "# Report",
            Path("/tmp/report.md"),
            {"version": "1.0.0"},
            None,
        )

    def fake_save_run_artifact(**kwargs):
        calls["artifact_kwargs"] = kwargs
        return "/tmp/run.json"

    monkeypatch.setattr(server, "fetch_vk_play_reviews", fake_fetch_vk_play_reviews)
    monkeypatch.setattr(server, "_run_pipeline_and_build_report", fake_run_pipeline_and_build_report)
    monkeypatch.setattr(server, "save_run_artifact", fake_save_run_artifact)
    monkeypatch.setattr(server, "update_version_history", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "get_current_version", lambda package_name: {"version": "1.0.0"})
    monkeypatch.setattr(server, "get_previous_version", lambda package_name: None)
    monkeypatch.setattr(server, "load_dashboard_config", lambda *args, **kwargs: {})
    monkeypatch.setattr(server, "log_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(server, "update_current_trace", lambda *args, **kwargs: None)

    result = asyncio.run(
        server._generate_dashboard(
            store="vk_play",
            url="https://vkplay.ru/play/game/pirate-ships-46035",
            max_reviews=25,
            langs_raw="ru",
            country="ru",
            period="14d",
            from_date=None,
            to_date=None,
            force_refresh=False,
            cache_ttl_hours=1,
            source="direct_url",
            selected_app_id=None,
        )
    )

    assert calls["fetch_kwargs"]["url"] == "https://vkplay.ru/play/game/pirate-ships-46035"
    assert calls["fetch_kwargs"]["lang"] == "ru"
    assert calls["pipeline_kwargs"]["package_name"] == "46035"
    assert calls["pipeline_kwargs"]["app_name"] == "Pirate Ships"
    assert calls["artifact_kwargs"]["artifact"]["store"] == "vk_play"
    assert result["package_name"] == "46035"


def test_report_sync_returns_503_for_yandex_games_fallback_needed(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        raise YandexGamesFallbackNeeded("bootstrap unavailable")

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "store": "yandex_games",
            "url": "https://yandex.ru/games/app/423744",
            "country": "ru",
        },
    )

    assert response.status_code == 503
    payload = response.json()
    assert "bootstrap unavailable" in payload["detail"]


def test_report_sync_accepts_yandex_games_country_all(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["store"] == "yandex_games"
        assert kwargs["country"] == "all"
        return {
            "run_id": "run-yandex-all",
            "package_name": "423744",
            "app_name": "Sample Yandex Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {},
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "store": "yandex_games",
            "url": "https://yandex.ru/games/app/423744",
            "country": "all",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-yandex-all"


def test_report_sse_contains_report_and_done(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        progress_callback = kwargs.get("progress_callback")
        if progress_callback:
            await progress_callback({"type": "status", "step": "resolved"})
        return {
            "run_id": "run-123",
            "package_name": "com.sample.game",
            "app_name": "Sample Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {
                "summary": {"title": "Сводка", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "signals": {"title": "Сигналы", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "issues": {"title": "Проблемы", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
                "actions": {"title": "Действия", "narrative": "", "cards": [], "metrics": {}, "updated_at": "2026-02-16T00:00:00Z"},
            },
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report",
        params={
            "url": "https://play.google.com/store/apps/details?id=com.sample.game",
            "country": "us",
        },
    )

    assert response.status_code == 200
    body = response.text
    assert '"type": "report"' in body
    assert '"type": "done"' in body


def test_report_sync_custom_period_requires_from_and_to() -> None:
    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "url": "https://play.google.com/store/apps/details?id=com.sample.game",
            "country": "us",
            "period": "custom",
        },
    )

    assert response.status_code == 422
    payload = response.json()
    assert "Custom period requires both 'from' and 'to'" in payload["detail"]


def test_report_sync_returns_404_for_empty_window(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        raise LookupError("No reviews found for region 'us' in the selected window (14d).")

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "url": "https://play.google.com/store/apps/details?id=com.sample.game",
            "country": "us",
            "period": "14d",
        },
    )

    assert response.status_code == 404
    payload = response.json()
    assert "No reviews found for region 'us'" in payload["detail"]


def test_report_sync_passes_custom_window_params(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["period"] == "custom"
        assert kwargs["from_date"] == "2026-02-01"
        assert kwargs["to_date"] == "2026-02-14"
        return {
            "run_id": "run-123",
            "package_name": "com.sample.game",
            "app_name": "Sample Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
            "report_layers": {},
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report/sync",
        params={
            "url": "https://play.google.com/store/apps/details?id=com.sample.game",
            "country": "us",
            "period": "custom",
            "from": "2026-02-01",
            "to": "2026-02-14",
        },
    )

    assert response.status_code == 200


def test_dashboard_config_get_default(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("dashboard_config.CONFIGS_DIR", tmp_path / "dashboard-configs")

    client = TestClient(server.app)
    response = client.get(
        "/api/dashboard-config",
        params={"package_name": "com.sample.game", "role_profile": "producer"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["package_name"] == "com.sample.game"
    assert payload["role_profile"] == "producer"
    assert "visible_tabs" in payload
    assert "visible_widgets" in payload
    assert "kpi_set" in payload


def test_dashboard_config_put_save_and_reload(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("dashboard_config.CONFIGS_DIR", tmp_path / "dashboard-configs")

    client = TestClient(server.app)
    put_response = client.put(
        "/api/dashboard-config",
        params={"package_name": "com.sample.game", "role_profile": "support"},
        json={
            "visible_tabs": ["summary", "signals"],
            "tab_order": ["signals", "summary"],
            "visible_widgets": ["status_cards", "layered_report"],
            "kpi_set": ["unanswered_percent", "spike_count"],
            "version": 2,
        },
    )

    assert put_response.status_code == 200
    put_payload = put_response.json()
    assert put_payload["role_profile"] == "support"
    assert put_payload["visible_tabs"] == ["summary", "signals"]
    assert put_payload["tab_order"] == ["signals", "summary"]
    assert put_payload["version"] == 2

    get_response = client.get(
        "/api/dashboard-config",
        params={"package_name": "com.sample.game", "role_profile": "support"},
    )
    assert get_response.status_code == 200
    get_payload = get_response.json()
    assert get_payload["visible_tabs"] == ["summary", "signals"]
    assert get_payload["kpi_set"] == ["unanswered_percent", "spike_count"]


def test_dashboard_config_put_rejects_invalid_keys(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("dashboard_config.CONFIGS_DIR", tmp_path / "dashboard-configs")

    client = TestClient(server.app)
    response = client.put(
        "/api/dashboard-config",
        params={"package_name": "com.sample.game", "role_profile": "engineering"},
        json={
            "visible_tabs": ["summary", "bad_tab"],
            "visible_widgets": ["status_cards"],
            "kpi_set": ["critical_count"],
        },
    )

    assert response.status_code == 422
