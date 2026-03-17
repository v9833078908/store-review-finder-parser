from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

import server


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
