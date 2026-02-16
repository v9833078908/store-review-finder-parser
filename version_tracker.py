from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from google_play_scraper import app

DATA_DIR = Path(__file__).resolve().parent / "data"


def _version_history_path(package_name: str) -> Path:
    return DATA_DIR / f"{package_name}_versions.json"


def load_version_history(package_name: str) -> list[dict]:
    """Load version history from disk. Returns empty list if file doesn't exist."""
    path = _version_history_path(package_name)
    if not path.exists():
        return []

    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            return data.get("versions", [])
    except (OSError, json.JSONDecodeError):
        return []


def _save_version_history(package_name: str, versions: list[dict]) -> None:
    """Save version history to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _version_history_path(package_name)
    payload = {
        "package_name": package_name,
        "versions": versions,
    }
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def update_version_history(package_name: str, app_metadata: dict) -> list[dict]:
    """
    Update version history with current app metadata.

    Args:
        package_name: Google Play package name
        app_metadata: Dict containing version, recent_changes, last_updated_on

    Returns:
        Updated list of version history entries
    """
    current_version = app_metadata.get("version")
    if not current_version:
        # No version info, return existing history unchanged
        return load_version_history(package_name)

    versions = load_version_history(package_name)

    # Check if this version already exists
    existing = next((v for v in versions if v.get("version") == current_version), None)

    if not existing:
        # New version, add it
        new_entry = {
            "version": current_version,
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "recent_changes": app_metadata.get("recent_changes", ""),
            "last_updated_on": app_metadata.get("last_updated_on", ""),
        }
        versions.append(new_entry)
        _save_version_history(package_name, versions)

    return versions


def get_current_version(package_name: str) -> dict | None:
    """Get the most recently seen version (last in list)."""
    versions = load_version_history(package_name)
    return versions[-1] if versions else None


def get_previous_version(package_name: str) -> dict | None:
    """Get the second-to-last version."""
    versions = load_version_history(package_name)
    return versions[-2] if len(versions) >= 2 else None
