from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from alerts import Alert


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _top_themes(themes: list[dict[str, Any]], *, sentiment: set[str], limit: int = 5) -> list[dict[str, Any]]:
    selected = [theme for theme in themes if str(theme.get("sentiment") or "mixed") in sentiment]
    selected.sort(
        key=lambda item: (
            int(item.get("severity") or 0),
            int(item.get("count") or 0),
        ),
        reverse=True,
    )
    return selected[:limit]


def _negative_share(reviews: list[dict[str, Any]]) -> float:
    if not reviews:
        return 0.0
    low_rating = sum(1 for review in reviews if int(review.get("rating") or 0) <= 2)
    return round(low_rating / len(reviews), 4)


def _summary_narrative(
    app_name: str,
    stats: dict[str, Any],
    top_issue: dict[str, Any] | None,
    alerts: list[Alert],
) -> str:
    reviews_analyzed = int(stats.get("reviews_analyzed") or 0)
    avg_rating = float(stats.get("avg_rating") or 0.0)
    period = str(stats.get("period") or "unknown")
    issue_label = str(top_issue.get("name") or "No dominant issue") if top_issue else "No dominant issue"
    issue_count = int(top_issue.get("count") or 0) if top_issue else 0
    dominant_lang = str(stats.get("dominant_lang") or "en").lower()

    if dominant_lang.startswith("ru"):
        if top_issue:
            return (
                f"{app_name}: за период {period} обработано {reviews_analyzed} отзывов, "
                f"средняя оценка {avg_rating:.2f}/5. Основной негативный фокус — «{issue_label}» "
                f"({issue_count} упоминаний). Активных сигналов: {len(alerts)}."
            )
        return (
            f"{app_name}: за период {period} обработано {reviews_analyzed} отзывов, "
            f"средняя оценка {avg_rating:.2f}/5. Критичных доминирующих проблем не выявлено. "
            f"Активных сигналов: {len(alerts)}."
        )

    if top_issue:
        return (
            f"{app_name}: {reviews_analyzed} reviews analyzed ({period}), average rating {avg_rating:.2f}/5. "
            f"Primary pressure point is '{issue_label}' ({issue_count} mentions). "
            f"Active signals: {len(alerts)}."
        )
    return (
        f"{app_name}: {reviews_analyzed} reviews analyzed ({period}), average rating {avg_rating:.2f}/5. "
        "No dominant negative cluster detected in the current sample. "
        f"Active signals: {len(alerts)}."
    )


def _summary_cards(
    stats: dict[str, Any],
    reviews: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    reviews_analyzed = int(stats.get("reviews_analyzed") or 0)
    avg_rating = float(stats.get("avg_rating") or 0.0)
    negative_share = _negative_share(reviews)

    return [
        {
            "id": "avg_rating",
            "title": "Average rating",
            "value": f"{avg_rating:.2f}/5",
            "description": "Current average review rating in selected window.",
        },
        {
            "id": "negative_share",
            "title": "Negative share",
            "value": f"{negative_share * 100:.1f}%",
            "description": "Share of 1-2 star reviews in selected window.",
        },
        {
            "id": "sample_size",
            "title": "Reviews analyzed",
            "value": str(reviews_analyzed),
            "description": "Sample size used to generate this run.",
        },
    ]


def _signals_cards(alerts: list[Alert]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for index, alert in enumerate(alerts[:5], start=1):
        cards.append(
            {
                "id": f"signal-{index}",
                "title": f"{alert.type}: {alert.subcategory}",
                "value": str(alert.count),
                "description": f"Baseline {alert.baseline:.2f}; window signal count {alert.count}.",
                "meta": {
                    "type": alert.type,
                    "subcategory": alert.subcategory,
                    "baseline": alert.baseline,
                    "count": alert.count,
                },
            }
        )
    return cards


def _issues_cards(themes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for index, theme in enumerate(_top_themes(themes, sentiment={"negative", "mixed"}, limit=5), start=1):
        cards.append(
            {
                "id": f"issue-{index}",
                "title": str(theme.get("name") or "Unnamed issue"),
                "value": f"{int(theme.get('count') or 0)} mentions",
                "description": f"Severity {int(theme.get('severity') or 0)}/5 · sentiment {theme.get('sentiment')}",
                "severity": int(theme.get("severity") or 0),
            }
        )
    return cards


def _actions_cards(alerts: list[Alert], themes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    if alerts:
        for index, alert in enumerate(alerts[:3], start=1):
            cards.append(
                {
                    "id": f"action-alert-{index}",
                    "title": f"Investigate {alert.subcategory}",
                    "value": "Suggested",
                    "description": (
                        f"Validate root cause for alert '{alert.type}' and verify impact across versions/devices."
                    ),
                    "meta": {"source": "alert", "alert_type": alert.type},
                }
            )
        return cards

    for index, theme in enumerate(_top_themes(themes, sentiment={"negative", "mixed"}, limit=3), start=1):
        cards.append(
            {
                "id": f"action-theme-{index}",
                "title": f"Review {theme.get('name')}",
                "value": "Suggested",
                "description": "Validate examples, scope impact, and define owner with next checkpoint.",
                "meta": {"source": "theme", "severity": int(theme.get("severity") or 0)},
            }
        )
    return cards


def build_report_layers(
    *,
    app_name: str,
    stats: dict[str, Any],
    reviews: list[dict[str, Any]],
    themes: list[dict[str, Any]],
    alerts: list[Alert],
    category_counts: dict[str, int],
) -> dict[str, dict[str, Any]]:
    updated_at = _iso_now()
    top_negative = _top_themes(themes, sentiment={"negative", "mixed"}, limit=1)
    top_issue = top_negative[0] if top_negative else None

    summary_cards = _summary_cards(stats, reviews)
    signals_cards = _signals_cards(alerts)
    issues_cards = _issues_cards(themes)
    actions_cards = _actions_cards(alerts, themes)

    negative_theme_count = len(_top_themes(themes, sentiment={"negative", "mixed"}, limit=100))
    positive_theme_count = len(_top_themes(themes, sentiment={"positive"}, limit=100))

    return {
        "summary": {
            "title": "Сводка",
            "narrative": _summary_narrative(app_name, stats, top_issue, alerts),
            "cards": summary_cards,
            "metrics": {
                "reviews_analyzed": int(stats.get("reviews_analyzed") or 0),
                "avg_rating": float(stats.get("avg_rating") or 0.0),
                "negative_share": _negative_share(reviews),
                "period": str(stats.get("period") or "unknown"),
            },
            "updated_at": updated_at,
        },
        "signals": {
            "title": "Сигналы",
            "narrative": (
                "Активных сигналов не обнаружено в текущем окне."
                if not alerts
                else f"Найдено {len(alerts)} активных сигналов. Приоритет — критичные и spike-сигналы."
            ),
            "cards": signals_cards,
            "metrics": {
                "alerts_total": len(alerts),
                "critical_alerts": sum(1 for alert in alerts if alert.type == "critical_subcategory"),
                "spike_alerts": sum(1 for alert in alerts if alert.type == "spike"),
            },
            "updated_at": updated_at,
        },
        "issues": {
            "title": "Проблемы",
            "narrative": (
                "Критичных проблемных кластеров не обнаружено."
                if not issues_cards
                else "Топ-проблемы отсортированы по влиянию: severity и объему упоминаний."
            ),
            "cards": issues_cards,
            "metrics": {
                "negative_themes": negative_theme_count,
                "positive_themes": positive_theme_count,
                "category_counts": category_counts,
            },
            "updated_at": updated_at,
        },
        "actions": {
            "title": "Действия",
            "narrative": (
                "Сформирован список рекомендуемых действий. Это рекомендации, не статусы task-трекера."
            ),
            "cards": actions_cards,
            "metrics": {
                "suggested_actions": len(actions_cards),
            },
            "updated_at": updated_at,
        },
    }

