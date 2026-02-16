from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
RUNS_DIR = DATA_DIR / "runs"


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    cleaned = cleaned.strip("_")
    return cleaned or "run"


def _prepare_json_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _prepare_json_value(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_prepare_json_value(item) for item in value]
    if hasattr(value, "_asdict"):
        return _prepare_json_value(value._asdict())
    return value


def save_run_artifact(package_name: str, app_name: str, artifact: dict[str, Any]) -> Path:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    run_id = str(artifact.get("run_id") or "unknown")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    filename = f"{_safe_name(app_name or package_name)}_{timestamp}_{_safe_name(run_id)}.json"
    path = RUNS_DIR / filename

    payload = _prepare_json_value(dict(artifact))
    payload["saved_at"] = datetime.now(timezone.utc).isoformat()
    payload["package_name"] = package_name
    payload["app_name"] = app_name

    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    return path


def load_run_artifact(run_id: str) -> dict[str, Any] | None:
    if not run_id:
        return None
    if not RUNS_DIR.exists():
        return None

    safe_run_id = _safe_name(run_id)
    exact_candidates = sorted(
        RUNS_DIR.glob(f"*_{safe_run_id}.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )

    def _read_json(path: Path) -> dict[str, Any] | None:
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict):
            return None
        return payload

    for path in exact_candidates:
        payload = _read_json(path)
        if payload and str(payload.get("run_id") or "") == run_id:
            return payload

    all_candidates = sorted(
        RUNS_DIR.glob("*.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    for path in all_candidates:
        payload = _read_json(path)
        if payload and str(payload.get("run_id") or "") == run_id:
            return payload

    return None
