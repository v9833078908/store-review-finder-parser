"""Google Play source adapter.

Wraps scraper.fetch_reviews() and converts the result to UnifiedFeedbackItem
so downstream pipeline code has a source-agnostic interface.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from models import UnifiedFeedbackItem
from scraper import fetch_reviews
from utils import log_event


class GooglePlaySource:
    """Collect reviews from Google Play for a single package."""

    source_name = "google_play"

    def __init__(
        self,
        package_name: str,
        max_reviews: int = 500,
        langs: list[str] | None = None,
        country: str = "us",
        force_refresh: bool = False,
        cache_ttl_hours: int = 24,
    ) -> None:
        self.package_name = package_name
        self.max_reviews = max_reviews
        self.langs = langs or ["en"]
        self.country = country
        self.force_refresh = force_refresh
        self.cache_ttl_hours = cache_ttl_hours

    def collect(self) -> tuple[list[UnifiedFeedbackItem], dict[str, Any]]:
        """Fetch reviews and return (items, app_metadata).

        Does NOT run in a thread — call via asyncio.to_thread() if needed
        from an async context (same as scraper.fetch_reviews).
        """
        payload = fetch_reviews(
            package_name=self.package_name,
            max_reviews=self.max_reviews,
            langs=self.langs,
            country=self.country,
            force_refresh=self.force_refresh,
            cache_ttl=timedelta(hours=self.cache_ttl_hours),
        )
        raw_reviews: list[dict[str, Any]] = payload.get("reviews") or []
        app_metadata: dict[str, Any] = payload.get("app_metadata") or {}

        items = [
            UnifiedFeedbackItem.from_legacy_dict(review, source=self.source_name)
            for review in raw_reviews
        ]
        log_event(
            "google_play_source_collected",
            package_name=self.package_name,
            country=self.country,
            reviews=len(items),
            from_cache=bool(payload.get("cache_hit")),
        )
        return items, app_metadata
