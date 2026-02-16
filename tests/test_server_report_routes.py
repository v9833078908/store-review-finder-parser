from __future__ import annotations

from fastapi.testclient import TestClient

import server


def test_report_sync_contract(monkeypatch) -> None:
    async def fake_generate_dashboard(**kwargs):
        assert kwargs["source"] in {"direct_url", "catalog"}
        return {
            "run_id": "run-123",
            "package_name": "com.sample.game",
            "app_name": "Sample Game",
            "report_path": "/tmp/report.md",
            "artifact_path": "/tmp/run.json",
            "markdown": "# Report",
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
            "source": "catalog",
            "app_id": "com.sample.game",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == "run-123"
    assert payload["package_name"] == "com.sample.game"


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
            "stats": {},
            "category_counts": {},
            "alerts_count": 0,
        }

    monkeypatch.setattr(server, "_generate_dashboard", fake_generate_dashboard)

    client = TestClient(server.app)
    response = client.get(
        "/api/report",
        params={"url": "https://play.google.com/store/apps/details?id=com.sample.game"},
    )

    assert response.status_code == 200
    body = response.text
    assert '"type": "report"' in body
    assert '"type": "done"' in body
