"""Domain models for GamePulse multi-source feedback pipeline.

UnifiedFeedbackItem is the canonical in-memory representation of a
single piece of user feedback, regardless of source (Google Play,
App Store, Telegram community, etc.).

Phase 1 note: the pipeline still operates on legacy dicts.  Use
``from_legacy_dict`` / ``to_legacy_dict`` as bridge helpers until
the pipeline is migrated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class UnifiedFeedbackItem:
    """A single feedback item normalised across all sources."""

    item_id: str
    text: str
    source: str = "google_play"  # key field for GamePulse multi-source routing
    rating: int | None = None
    date: str = ""
    version: str | None = None
    lang: str = "en"
    # store-specific optional fields kept for backward-compat
    original_lang: str | None = None
    has_reply: bool | None = None
    reply_text: str | None = None
    reply_date: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    # ------------------------------------------------------------------
    # Bridge helpers
    # ------------------------------------------------------------------

    def to_legacy_dict(self) -> dict[str, Any]:
        """Convert to the legacy review dict format used by the current pipeline."""
        result: dict[str, Any] = {
            "review_id": self.item_id,
            "text": self.text,
            "rating": self.rating,
            "date": self.date,
            "version": self.version,
            "lang": self.lang,
        }
        if self.original_lang is not None:
            result["original_lang"] = self.original_lang
        if self.has_reply is not None:
            result["has_reply"] = self.has_reply
        if self.reply_text is not None:
            result["reply_text"] = self.reply_text
        if self.reply_date is not None:
            result["reply_date"] = self.reply_date
        result.update(self.extra)
        return result

    @classmethod
    def from_legacy_dict(cls, d: dict[str, Any], source: str = "google_play") -> "UnifiedFeedbackItem":
        """Build from a legacy review dict."""
        extra = {
            k: v
            for k, v in d.items()
            if k not in {
                "review_id",
                "text",
                "rating",
                "date",
                "version",
                "lang",
                "original_lang",
                "has_reply",
                "reply_text",
                "reply_date",
            }
        }
        rating_raw = d.get("rating")
        try:
            rating = int(rating_raw) if rating_raw is not None else None
        except (TypeError, ValueError):
            rating = None

        return cls(
            item_id=str(d.get("review_id") or ""),
            text=str(d.get("text") or ""),
            source=source,
            rating=rating,
            date=str(d.get("date") or ""),
            version=d.get("version"),
            lang=str(d.get("lang") or "en"),
            original_lang=d.get("original_lang"),
            has_reply=d.get("has_reply"),
            reply_text=d.get("reply_text"),
            reply_date=d.get("reply_date"),
            extra=extra,
        )
