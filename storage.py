from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils import safe_name as _safe_name_util

DATA_DIR = Path(__file__).resolve().parent / "data"
RUNS_DIR = DATA_DIR / "runs"


def _safe_name(value: str) -> str:
    return _safe_name_util(value, fallback="run")


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


_HISTORY_SUMMARY_FIELDS = frozenset(
    {
        "run_id",
        "package_name",
        "app_name",
        "saved_at",
        "country",
        "window_mode",
        "reviews_selected",
        "current_version",
        "previous_version",
    }
)


def list_run_artifacts(
    package_name: str | None = None,
    limit: int = 10,
    unique_apps: bool = False,
) -> list[dict[str, Any]]:
    """Return summary metadata for the most recent run artifacts.

    Reads ``data/runs/*.json`` files, sorted by file modification time
    (newest first).  Broken JSON files are silently skipped.  When
    *package_name* is given, only artifacts matching that package are
    included.  When *unique_apps* is ``True``, only the most recent run
    per ``package_name`` is returned.  At most *limit* items are returned.
    """
    if not RUNS_DIR.exists():
        return []

    all_files = sorted(
        RUNS_DIR.glob("*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    seen_packages: set[str] = set()
    items: list[dict[str, Any]] = []
    for path in all_files:
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        pkg = str(payload.get("package_name") or "")
        if package_name and pkg != package_name:
            continue
        if unique_apps:
            if pkg in seen_packages:
                continue
            seen_packages.add(pkg)
        summary = {key: payload[key] for key in _HISTORY_SUMMARY_FIELDS if key in payload}
        items.append(summary)
        if len(items) >= limit:
            break

    return items


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
