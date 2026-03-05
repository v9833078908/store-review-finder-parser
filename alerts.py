from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, NamedTuple

from config import (
    CRITICAL_SUBCATEGORIES,
    MIN_BASELINE_DAYS,
    MIN_SPIKE_COUNT,
    NEW_ISSUE_CLUSTER_THRESHOLD,
    SPIKE_MULTIPLIER,
    SPIKE_WINDOW_HOURS,
)
from utils import parse_date


class Alert(NamedTuple):
    """Represents a detected alert condition."""

    type: str
    subcategory: str
    count: int
    baseline: float
    details: dict[str, Any]


def _calculate_baseline(
    reviews: list[dict[str, Any]],
    classified: list[dict[str, Any]],
    previous_version: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Calculate baseline metrics from previous version period.

    Returns:
      - new_bug_per_day: average daily new_bug count
      - total_days: number of days represented in baseline
      - total_new_bugs: raw count used for baseline
    """
    if not previous_version:
        return {"new_bug_per_day": 0.0, "total_days": 0, "total_new_bugs": 0}

    prev_version_str = previous_version.get("version")
    if not prev_version_str:
        return {"new_bug_per_day": 0.0, "total_days": 0, "total_new_bugs": 0}

    classification_map = {str(c.get("review_id") or ""): c for c in classified}

    prev_reviews = []
    for review in reviews:
        if review.get("version") != prev_version_str:
            continue
        review_id = str(review.get("review_id") or "")
        classification = classification_map.get(review_id, {})
        if classification.get("category") == "new_bug":
            prev_reviews.append(review)

    if not prev_reviews:
        return {"new_bug_per_day": 0.0, "total_days": 0, "total_new_bugs": 0}

    dates = [parse_date(str(r.get("date", ""))) for r in prev_reviews]
    valid_dates = [d for d in dates if d is not None]
    if not valid_dates:
        return {"new_bug_per_day": 0.0, "total_days": 0, "total_new_bugs": len(prev_reviews)}

    date_range = (max(valid_dates) - min(valid_dates)).days + 1
    date_range = max(1, date_range)

    return {
        "new_bug_per_day": len(prev_reviews) / date_range,
        "total_days": date_range,
        "total_new_bugs": len(prev_reviews),
    }


def _windowed_new_bugs(
    current_reviews: list[dict[str, Any]],
    first_seen_dt: datetime | None,
) -> list[dict[str, Any]]:
    dated_reviews: list[tuple[dict[str, Any], datetime]] = []
    for review in current_reviews:
        if review.get("category") != "new_bug":
            continue
        dt = parse_date(str(review.get("date", "")))
        if dt is not None:
            dated_reviews.append((review, dt))

    if not dated_reviews:
        return []

    if first_seen_dt is not None:
        start = first_seen_dt
        end = start + timedelta(hours=SPIKE_WINDOW_HOURS)
    else:
        end = max(dt for _, dt in dated_reviews)
        start = end - timedelta(hours=SPIKE_WINDOW_HOURS)

    return [review for review, dt in dated_reviews if start <= dt <= end]


def detect_alerts(
    reviews: list[dict[str, Any]],
    classified: list[dict[str, Any]],
    current_version: dict[str, Any] | None,
    previous_version: dict[str, Any] | None,
) -> list[Alert]:
    """
    Detect alert conditions from classified reviews.

    Uses a minimum absolute threshold (`MIN_SPIKE_COUNT`) to avoid noisy spikes
    when historical baseline is weak or unavailable.
    """
    alerts: list[Alert] = []

    if not classified or not current_version:
        return alerts

    current_version_str = current_version.get("version")
    first_seen_str = current_version.get("first_seen")
    first_seen_dt = parse_date(first_seen_str) if first_seen_str else None

    classification_map = {str(c.get("review_id") or ""): c for c in classified}

    current_reviews: list[dict[str, Any]] = []
    for review in reviews:
        if review.get("version") != current_version_str:
            continue
        review_id = str(review.get("review_id") or "")
        if review_id in classification_map:
            current_reviews.append({**review, **classification_map[review_id]})

    if not current_reviews:
        return alerts

    baseline = _calculate_baseline(reviews, classified, previous_version)
    baseline_new_bug_per_day = float(baseline.get("new_bug_per_day") or 0.0)
    baseline_days = int(baseline.get("total_days") or 0)
    baseline_is_reliable = baseline_days >= MIN_BASELINE_DAYS and baseline_new_bug_per_day > 0

    new_bugs_in_window = _windowed_new_bugs(current_reviews, first_seen_dt)

    if baseline_is_reliable:
        expected_window = baseline_new_bug_per_day * (SPIKE_WINDOW_HOURS / 24.0) * SPIKE_MULTIPLIER
        spike_threshold = max(MIN_SPIKE_COUNT, int(round(expected_window)))
    else:
        spike_threshold = MIN_SPIKE_COUNT

    if len(new_bugs_in_window) >= spike_threshold:
        alerts.append(
            Alert(
                type="spike",
                subcategory="general",
                count=len(new_bugs_in_window),
                baseline=baseline_new_bug_per_day,
                details={
                    "window_hours": SPIKE_WINDOW_HOURS,
                    "threshold": spike_threshold,
                    "baseline_days": baseline_days,
                    "baseline_reliable": baseline_is_reliable,
                },
            )
        )

    new_bugs = [r for r in current_reviews if r.get("category") == "new_bug"]
    subcategory_counts = Counter(str(r.get("subcategory") or "other") for r in new_bugs)

    for subcategory, count in subcategory_counts.items():
        if count < NEW_ISSUE_CLUSTER_THRESHOLD:
            continue

        device_breakdown: dict[str, int] = defaultdict(int)
        for review in new_bugs:
            if str(review.get("subcategory") or "other") != subcategory:
                continue
            device = str(review.get("device_mention") or "other")
            device_breakdown[device] += 1

        alerts.append(
            Alert(
                type="new_issue_cluster",
                subcategory=subcategory,
                count=count,
                baseline=0.0,
                details={"devices": dict(device_breakdown)},
            )
        )

    for subcat in CRITICAL_SUBCATEGORIES:
        subcat_bugs = [r for r in new_bugs if r.get("subcategory") == subcat]
        if not subcat_bugs:
            continue

        alerts.append(
            Alert(
                type="critical_subcategory",
                subcategory=subcat,
                count=len(subcat_bugs),
                baseline=0.0,
                details={"severity": "critical"},
            )
        )

    return alerts
