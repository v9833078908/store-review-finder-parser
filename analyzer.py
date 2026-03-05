from __future__ import annotations

import asyncio
import json
import re
from difflib import SequenceMatcher
from typing import Any

from config import DEFAULT_MAX_CONCURRENCY, THEME_BATCH_SIZE
from llm import call_llm
from utils import (
    ProgressCallback,
    chunked,
    compact_review,
    extract_json_text,
    load_prompt,
    review_stats,
    run_batched,
    to_json,
)


def _normalize_theme(raw: dict[str, Any]) -> dict[str, Any]:
    name = str(raw.get("name") or "").strip()
    sentiment = str(raw.get("sentiment") or "mixed").strip().lower()
    if sentiment not in {"negative", "positive", "neutral", "mixed"}:
        sentiment = "mixed"

    try:
        severity = int(raw.get("severity", 3))
    except Exception:
        severity = 3
    severity = max(1, min(5, severity))

    try:
        count = int(raw.get("count", 1))
    except Exception:
        count = 1
    count = max(1, count)

    avg_rating_raw = raw.get("avg_rating")
    avg_rating = None
    if avg_rating_raw is not None:
        try:
            avg_rating = max(1.0, min(5.0, float(avg_rating_raw)))
        except Exception:
            avg_rating = None

    quotes: list[str] = []
    for quote in raw.get("quotes") or []:
        quote_text = str(quote).strip()
        if quote_text and quote_text not in quotes:
            quotes.append(quote_text)

    if not name:
        name = "Unnamed theme"

    return {
        "name": name,
        "sentiment": sentiment,
        "severity": severity,
        "count": count,
        "avg_rating": avg_rating,
        "quotes": quotes[:4],
    }


def _normalize_theme_key(name: str) -> str:
    key = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    key = re.sub(r"\s+", " ", key).strip()
    return key


def _themes_match(left: str, right: str) -> bool:
    left_key = _normalize_theme_key(left)
    right_key = _normalize_theme_key(right)
    if not left_key or not right_key:
        return False
    if left_key == right_key:
        return True
    if left_key in right_key or right_key in left_key:
        return True
    return SequenceMatcher(a=left_key, b=right_key).ratio() >= 0.82


async def _analyze_batch(
    batch: list[dict[str, Any]],
    prompt_template: str,
) -> list[dict[str, Any]]:
    compact_batch = [compact_review(review, max_text=800) for review in batch]
    prompt = prompt_template.replace("{{REVIEWS_JSON}}", to_json(compact_batch))
    raw = await call_llm(prompt, task="theme_extraction", max_tokens=1800)
    parsed = json.loads(extract_json_text(raw))
    if isinstance(parsed, dict):
        parsed = parsed.get("themes", [])
    if not isinstance(parsed, list):
        raise ValueError("Model returned unexpected payload for batch analysis.")
    return [_normalize_theme(item) for item in parsed if isinstance(item, dict)]


# ---------------------------------------------------------------------------
# merge_themes — split into three focused functions
# ---------------------------------------------------------------------------

def _accumulate_themes(all_themes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group and merge theme dicts that refer to the same concept."""
    merged: list[dict[str, Any]] = []
    for theme in all_themes:
        match = next((item for item in merged if _themes_match(item["name"], theme["name"])), None)
        if not match:
            merged.append(
                {
                    "name": theme["name"],
                    "count": theme["count"],
                    "severity_total": theme["severity"] * theme["count"],
                    "sentiments": {theme["sentiment"]: theme["count"]},
                    "quotes": list(theme["quotes"]),
                    "rating_total": (theme["avg_rating"] or 0.0) * theme["count"],
                    "rating_weight": theme["count"] if theme["avg_rating"] is not None else 0,
                }
            )
            continue

        match["count"] += theme["count"]
        match["severity_total"] += theme["severity"] * theme["count"]
        match["sentiments"][theme["sentiment"]] = match["sentiments"].get(theme["sentiment"], 0) + theme["count"]
        for quote in theme["quotes"]:
            if quote and quote not in match["quotes"]:
                match["quotes"].append(quote)
        if theme["avg_rating"] is not None:
            match["rating_total"] += theme["avg_rating"] * theme["count"]
            match["rating_weight"] += theme["count"]

    return merged


def _consolidate_themes(merged: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute final sentiment, severity, and sort by relevance."""
    consolidated: list[dict[str, Any]] = []
    for item in merged:
        sentiment = max(item["sentiments"].items(), key=lambda pair: pair[1])[0]
        avg_rating = None
        if item["rating_weight"] > 0:
            avg_rating = item["rating_total"] / item["rating_weight"]
        consolidated.append(
            {
                "name": item["name"],
                "sentiment": sentiment,
                "count": item["count"],
                "severity": round(item["severity_total"] / max(1, item["count"])),
                "avg_rating": avg_rating,
                "quotes": item["quotes"][:4],
            }
        )
    consolidated.sort(key=lambda item: (item["severity"], item["count"]), reverse=True)
    return consolidated


def merge_themes(all_themes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge raw per-batch themes into a deduplicated, sorted list."""
    return _consolidate_themes(_accumulate_themes(all_themes))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def run_theme_extraction(
    reviews: list[dict[str, Any]],
    semaphore: asyncio.Semaphore,
    batch_size: int = THEME_BATCH_SIZE,
    progress_callback: ProgressCallback | None = None,
) -> list[dict[str, Any]]:
    if not reviews:
        return []

    prompt_template = load_prompt("analyze_batch.txt")
    raw_themes = await run_batched(
        items=reviews,
        batch_size=batch_size,
        processor=lambda batch: _analyze_batch(batch, prompt_template),
        semaphore=semaphore,
        progress_callback=progress_callback,
    )
    return merge_themes(raw_themes)


async def _generate_summary(
    themes: list[dict[str, Any]],
    app_name: str,
    stats: dict[str, Any],
) -> str:
    prompt_template = load_prompt("executive_summary.txt")
    prompt = (
        prompt_template.replace("{{APP_NAME}}", app_name)
        .replace("{{STATS_JSON}}", to_json(stats))
        .replace("{{THEMES_JSON}}", to_json(themes))
    )
    return await call_llm(prompt, task="synthesis", max_tokens=1400)


async def analyze_reviews(reviews: list[dict[str, Any]], app_name: str) -> str:
    """Compatibility wrapper for legacy report mode."""
    if not reviews:
        return (
            f"# Review Analysis: {app_name}\n\n"
            "**Period:** unknown | **Reviews analyzed:** 0 | **Avg rating:** 0.00/5\n\n"
            "No reviews were found."
        )

    from utils import escape_table_cell, format_rating

    semaphore = asyncio.Semaphore(DEFAULT_MAX_CONCURRENCY)
    themes = await run_theme_extraction(reviews, semaphore)
    stats = review_stats(reviews)
    summary = await _generate_summary(themes, app_name, stats)

    critical = [item for item in themes if item["sentiment"] in {"negative", "mixed"}]
    critical.sort(key=lambda item: (item["severity"], item["count"]), reverse=True)
    positive = [item for item in themes if item["sentiment"] == "positive"]
    positive.sort(key=lambda item: item["count"], reverse=True)

    lines = [
        f"# Review Analysis: {app_name}",
        "",
        (
            f"**Period:** {stats['period']} | "
            f"**Reviews analyzed:** {stats['reviews_analyzed']} | "
            f"**Avg rating:** {stats['avg_rating']:.2f}/5"
        ),
        "",
        "## Executive Summary",
        summary.strip() or "Summary is unavailable.",
        "",
        "## Critical Issues",
    ]

    if critical:
        for index, theme in enumerate(critical[:5], start=1):
            lines.append(
                f"### {index}. {theme['name']} ({theme['count']} mentions, severity {theme['severity']}/5)"
            )
            for quote in theme["quotes"][:2]:
                lines.append(f"> {quote}")
            lines.append("")
    else:
        lines.extend(["No critical issues found.", ""])

    lines.append("## What Players Love")
    if positive:
        for index, theme in enumerate(positive[:5], start=1):
            lines.append(f"### {index}. {theme['name']} ({theme['count']} mentions)")
            for quote in theme["quotes"][:2]:
                lines.append(f"> {quote}")
            lines.append("")
    else:
        lines.extend(["No strong positive themes found.", ""])

    lines.extend(
        [
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
                    escape_table_cell(theme["name"]),
                    theme["sentiment"],
                    str(theme["count"]),
                    str(theme["severity"]),
                    format_rating(theme.get("avg_rating"), stats["avg_rating"]),
                ]
            )
            + " |"
        )

    return "\n".join(lines).strip() + "\n"
