from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient

import server
import storage


def _write_run(
    runs_dir: Path,
    run_id: str,
    package_name: str,
    app_name: str,
    saved_at: str,
    store: str | None = None,
) -> None:
    filename = f"{app_name.replace(' ', '_')}_{saved_at.replace(':', '').replace('-', '')}_{run_id}.json"
    payload = {
        "run_id": run_id,
        "package_name": package_name,
        "app_name": app_name,
        "saved_at": saved_at,
        "country": "us",
        "window_mode": "7d",
        "reviews_selected": 42,
    }
    if store:
        payload["store"] = store
    (runs_dir / filename).write_text(
        json.dumps(payload),
        encoding="utf-8",
    )


def test_get_runs_returns_200_with_correct_contract(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)
    _write_run(tmp_path, "abc123", "com.example.app", "Test App", "2026-02-17T00:00:00Z")

    client = TestClient(server.app)
    response = client.get("/api/runs")

    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert "count" in payload
    assert payload["count"] == 1
    item = payload["items"][0]
    assert item["run_id"] == "abc123"
    assert item["package_name"] == "com.example.app"
    assert item["app_name"] == "Test App"
    assert item["saved_at"] == "2026-02-17T00:00:00Z"
    assert "reviews" not in item
    assert "classified" not in item


def test_get_runs_sorted_by_mtime_descending(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)

    _write_run(tmp_path, "old111", "com.example.app", "Test App", "2026-02-15T00:00:00Z")
    time.sleep(0.02)
    _write_run(tmp_path, "new222", "com.example.app", "Test App", "2026-02-17T00:00:00Z")

    client = TestClient(server.app)
    response = client.get("/api/runs")

    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["run_id"] == "new222"
    assert items[1]["run_id"] == "old111"


def test_get_runs_filtered_by_package_name(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)
    _write_run(tmp_path, "run-a", "com.example.alpha", "Alpha App", "2026-02-17T01:00:00Z")
    time.sleep(0.02)
    _write_run(tmp_path, "run-b", "com.example.beta", "Beta App", "2026-02-17T02:00:00Z")

    client = TestClient(server.app)
    response = client.get("/api/runs", params={"package_name": "com.example.alpha"})

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["run_id"] == "run-a"


def test_get_runs_limit_respected(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)
    for i in range(5):
        time.sleep(0.01)
        _write_run(tmp_path, f"run-{i:02d}", "com.example.app", "Test App", f"2026-02-{10 + i:02d}T00:00:00Z")

    client = TestClient(server.app)
    response = client.get("/api/runs", params={"limit": 3})

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 3
    assert len(payload["items"]) == 3


def test_get_runs_invalid_limit_returns_422(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)

    client = TestClient(server.app)
    response = client.get("/api/runs", params={"limit": 100})

    assert response.status_code == 422


def test_get_runs_skips_broken_json(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)
    (tmp_path / "broken.json").write_text("{not valid json", encoding="utf-8")
    _write_run(tmp_path, "good-run", "com.example.app", "Test App", "2026-02-17T00:00:00Z")

    client = TestClient(server.app)
    response = client.get("/api/runs")

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["run_id"] == "good-run"


def test_get_runs_empty_when_no_files(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)

    client = TestClient(server.app)
    response = client.get("/api/runs")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["count"] == 0


def test_get_runs_includes_store_for_app_store_artifact(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)
    _write_run(tmp_path, "ios123", "123456789", "Sample iOS Game", "2026-02-17T00:00:00Z", store="app_store")

    client = TestClient(server.app)
    response = client.get("/api/runs")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["package_name"] == "123456789"
    assert item["store"] == "app_store"


def test_get_run_with_ru_lang_uses_localization(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(storage, "RUNS_DIR", tmp_path)
    run_id = "ru-loc-1"
    _write_run(tmp_path, run_id, "com.example.app", "Test App", "2026-02-17T00:00:00Z")

    localized_title = "Локализованный заголовок"

    async def fake_localize(payload, locale):
        assert locale == "ru"
        patched = dict(payload)
        patched["app_name"] = localized_title
        return patched

    monkeypatch.setattr(server, "localize_run_payload", fake_localize)

    client = TestClient(server.app)
    response = client.get(f"/api/runs/{run_id}", params={"lang": "ru"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == run_id
    assert payload["app_name"] == localized_title
