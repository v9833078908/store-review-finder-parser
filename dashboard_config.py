from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from utils import safe_name as _safe_name_util

DATA_DIR = Path(__file__).resolve().parent / "data"
CONFIGS_DIR = DATA_DIR / "dashboard-configs"

DEFAULT_ROLE_PROFILE = "producer"
ROLE_PROFILES = {"producer", "support", "engineering"}

VALID_TABS = ("summary", "signals", "issues", "actions")
VALID_WIDGETS = ("status_cards", "timeline", "top_clusters", "action_board", "layered_report")
VALID_KPIS = (
    "current_rating",
    "rating_trend",
    "low_rating_share",
    "low_rating_share_change",
    "new_clusters",
    "spike_count",
    "critical_count",
    "unanswered_percent",
    "unanswered_negatives",
    "total_unanswered",
)

DEFAULT_CONFIG_BY_ROLE: dict[str, dict[str, Any]] = {
    "producer": {
        "visible_tabs": ["summary", "signals", "issues", "actions"],
        "tab_order": ["summary", "signals", "issues", "actions"],
        "visible_widgets": ["status_cards", "timeline", "top_clusters", "action_board", "layered_report"],
        "kpi_set": [
            "current_rating",
            "low_rating_share",
            "new_clusters",
            "critical_count",
            "unanswered_percent",
        ],
        "version": 1,
    },
    "support": {
        "visible_tabs": ["summary", "signals", "issues", "actions"],
        "tab_order": ["summary", "signals", "issues", "actions"],
        "visible_widgets": ["status_cards", "top_clusters", "action_board", "layered_report"],
        "kpi_set": [
            "unanswered_percent",
            "unanswered_negatives",
            "total_unanswered",
            "new_clusters",
            "spike_count",
        ],
        "version": 1,
    },
    "engineering": {
        "visible_tabs": ["summary", "signals", "issues", "actions"],
        "tab_order": ["signals", "issues", "actions", "summary"],
        "visible_widgets": ["status_cards", "timeline", "top_clusters", "layered_report"],
        "kpi_set": [
            "critical_count",
            "spike_count",
            "new_clusters",
            "rating_trend",
            "current_rating",
        ],
        "version": 1,
    },
}


def _safe_name(value: str) -> str:
    return _safe_name_util(value, fallback="default")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _unique_ordered(items: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        output.append(item)
    return output


def normalize_role_profile(role_profile: str | None) -> str:
    value = str(role_profile or DEFAULT_ROLE_PROFILE).strip().lower()
    if value in ROLE_PROFILES:
        return value
    return DEFAULT_ROLE_PROFILE


def build_default_dashboard_config(package_name: str, role_profile: str | None = None) -> dict[str, Any]:
    resolved_role = normalize_role_profile(role_profile)
    defaults = DEFAULT_CONFIG_BY_ROLE.get(resolved_role, DEFAULT_CONFIG_BY_ROLE[DEFAULT_ROLE_PROFILE])
    return {
        "package_name": package_name,
        "role_profile": resolved_role,
        "visible_tabs": list(defaults["visible_tabs"]),
        "tab_order": list(defaults["tab_order"]),
        "visible_widgets": list(defaults["visible_widgets"]),
        "kpi_set": list(defaults["kpi_set"]),
        "version": int(defaults.get("version") or 1),
        "updated_at": _now_iso(),
    }


def _normalize_string_list(raw: Any, valid: tuple[str, ...], field_name: str) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError(f"{field_name} must be a list")

    normalized: list[str] = []
    valid_values = set(valid)
    for item in raw:
        value = str(item).strip().lower()
        if not value:
            continue
        if value not in valid_values:
            raise ValueError(f"Unsupported value in {field_name}: {value}")
        normalized.append(value)
    return _unique_ordered(normalized)


def validate_and_merge_dashboard_config(
    package_name: str,
    role_profile: str,
    payload: dict[str, Any] | None,
    base_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise ValueError("Payload must be an object")

    resolved_role = normalize_role_profile(role_profile)
    merged = dict(base_config or build_default_dashboard_config(package_name, resolved_role))

    if "visible_tabs" in payload:
        visible_tabs = _normalize_string_list(payload.get("visible_tabs"), VALID_TABS, "visible_tabs")
        if not visible_tabs:
            raise ValueError("visible_tabs must include at least one tab")
        merged["visible_tabs"] = visible_tabs

    if "tab_order" in payload:
        tab_order = _normalize_string_list(payload.get("tab_order"), VALID_TABS, "tab_order")
        merged["tab_order"] = tab_order

    if "visible_widgets" in payload:
        visible_widgets = _normalize_string_list(payload.get("visible_widgets"), VALID_WIDGETS, "visible_widgets")
        if not visible_widgets:
            raise ValueError("visible_widgets must include at least one widget")
        merged["visible_widgets"] = visible_widgets

    if "kpi_set" in payload:
        kpi_set = _normalize_string_list(payload.get("kpi_set"), VALID_KPIS, "kpi_set")
        if not kpi_set:
            raise ValueError("kpi_set must include at least one KPI")
        merged["kpi_set"] = kpi_set

    if "version" in payload:
        version = payload.get("version")
        if isinstance(version, bool):
            raise ValueError("version must be integer")
        if version is None:
            raise ValueError("version must be integer")
        version_int = int(version)
        if version_int <= 0:
            raise ValueError("version must be greater than 0")
        merged["version"] = version_int

    visible_tabs = list(merged.get("visible_tabs") or [])
    if not visible_tabs:
        raise ValueError("visible_tabs must include at least one tab")

    tab_order = list(merged.get("tab_order") or [])
    if not tab_order:
        tab_order = visible_tabs

    # Keep tab order consistent with visible tabs.
    tab_order = [tab for tab in tab_order if tab in visible_tabs]
    for tab in visible_tabs:
        if tab not in tab_order:
            tab_order.append(tab)

    merged["package_name"] = package_name
    merged["role_profile"] = resolved_role
    merged["visible_tabs"] = _unique_ordered(visible_tabs)
    merged["tab_order"] = _unique_ordered(tab_order)
    merged["visible_widgets"] = _unique_ordered(list(merged.get("visible_widgets") or []))
    merged["kpi_set"] = _unique_ordered(list(merged.get("kpi_set") or []))
    merged["version"] = int(merged.get("version") or 1)
    merged["updated_at"] = _now_iso()

    if not merged["visible_widgets"]:
        raise ValueError("visible_widgets must include at least one widget")
    if not merged["kpi_set"]:
        raise ValueError("kpi_set must include at least one KPI")

    return merged


def _config_path(package_name: str, role_profile: str) -> Path:
    safe_package = _safe_name(package_name)
    safe_role = _safe_name(normalize_role_profile(role_profile))
    return CONFIGS_DIR / f"{safe_package}__{safe_role}.json"


def load_dashboard_config(package_name: str, role_profile: str | None = None) -> dict[str, Any]:
    if not package_name:
        raise ValueError("package_name is required")

    resolved_role = normalize_role_profile(role_profile)
    path = _config_path(package_name, resolved_role)
    if not path.exists():
        return build_default_dashboard_config(package_name, resolved_role)

    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return build_default_dashboard_config(package_name, resolved_role)

    if not isinstance(payload, dict):
        return build_default_dashboard_config(package_name, resolved_role)

    base = build_default_dashboard_config(package_name, resolved_role)
    try:
        return validate_and_merge_dashboard_config(package_name, resolved_role, payload, base)
    except ValueError:
        return base


def save_dashboard_config(
    package_name: str,
    role_profile: str | None,
    payload: dict[str, Any] | None,
) -> dict[str, Any]:
    if not package_name:
        raise ValueError("package_name is required")

    resolved_role = normalize_role_profile(role_profile)
    current = load_dashboard_config(package_name, resolved_role)
    normalized = validate_and_merge_dashboard_config(package_name, resolved_role, payload, current)

    CONFIGS_DIR.mkdir(parents=True, exist_ok=True)
    path = _config_path(package_name, resolved_role)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(normalized, handle, ensure_ascii=False, indent=2)

    return normalized

