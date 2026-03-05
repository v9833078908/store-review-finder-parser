from __future__ import annotations

from typing import Any

from alerts import Alert
from utils import escape_table_cell as _escape_table_cell, format_rating as _format_rating


def _version_transition(current_version: dict[str, Any] | None, previous_version: dict[str, Any] | None) -> str:
    current = current_version.get("version") if current_version else "unknown"
    previous = previous_version.get("version") if previous_version else "unknown"
    return f"{previous} → {current}"


def _fallback_sections(
    themes: list[dict[str, Any]],
    alerts: list[Alert],
    category_counts: dict[str, int],
) -> str:
    top_negative = [theme for theme in themes if theme.get("sentiment") in {"negative", "mixed"}][:3]
    top_positive = [theme for theme in themes if theme.get("sentiment") == "positive"][:3]

    lines = [
        "## Executive Summary",
        "Unified report synthesis is unavailable, showing deterministic fallback.",
        "",
        "## Alerts & New Issues",
    ]

    if alerts:
        for alert in alerts[:5]:
            lines.append(
                f"- **{alert.type} / {alert.subcategory}**: {alert.count} reports "
                f"(baseline {alert.baseline:.2f})"
            )
    else:
        lines.append("- No alerts detected in the analyzed window.")

    lines.extend(["", "## Top Issues by Theme"])
    if top_negative:
        for theme in top_negative:
            lines.append(f"- **{theme['name']}**: {theme['count']} mentions, severity {theme['severity']}/5")
    else:
        lines.append("- No strong negative themes detected.")

    lines.extend(["", "## What Players Love"])
    if top_positive:
        for theme in top_positive:
            lines.append(f"- **{theme['name']}**: {theme['count']} mentions")
    else:
        lines.append("- No strong positive themes detected.")

    lines.extend(
        [
            "",
            "## Recommendations",
            "1. Immediate: investigate top negative themes and any critical alerts.",
            "2. Short-term: prioritize fixes by severity and mention volume.",
            "3. Monitor: track category distribution and spike trends after next release.",
            "",
            f"_Category mix: {category_counts}_",
        ]
    )
    return "\n".join(lines).strip()


def build_unified_report(
    app_name: str,
    stats: dict[str, Any],
    themes: list[dict[str, Any]],
    alerts: list[Alert],
    category_counts: dict[str, int],
    synthesis_markdown: str,
    current_version: dict[str, Any] | None = None,
    previous_version: dict[str, Any] | None = None,
    run_id: str | None = None,
) -> str:
    if synthesis_markdown.strip():
        sections = synthesis_markdown.strip()
    else:
        sections = _fallback_sections(themes, alerts, category_counts)

    lines = [
        f"# Unified Review Dashboard: {app_name}",
        "",
        (
            f"**Version:** {_version_transition(current_version, previous_version)} | "
            f"**Period:** {stats['period']} | "
            f"**Reviews analyzed:** {stats['reviews_analyzed']} | "
            f"**Avg rating:** {stats['avg_rating']:.2f}/5"
        ),
    ]
    if run_id:
        lines.append(f"**Run ID:** `{run_id}`")
    lines.extend(
        [
            "",
            sections,
            "",
            "## All Themes",
            "| Theme | Sentiment | Count | Severity | Avg Rating |",
            "|-------|-----------|-------|----------|------------|",
        ]
    )

    for theme in themes:
        lines.append(
            "| "
            + " | ".join(
                [
                    _escape_table_cell(str(theme.get("name") or "Unnamed")),
                    str(theme.get("sentiment") or "mixed"),
                    str(theme.get("count") or 0),
                    str(theme.get("severity") or 3),
                    _format_rating(theme.get("avg_rating"), float(stats.get("avg_rating") or 0.0)),
                ]
            )
            + " |"
        )

    return "\n".join(lines).strip() + "\n"
