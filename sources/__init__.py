"""sources/ — pluggable feedback collectors for GamePulse.

Each source wraps a scraper/API and emits UnifiedFeedbackItem lists.
Phase 1 ships GooglePlaySource only; App Store and Telegram are Phase 2.
"""

from sources.google_play import GooglePlaySource

__all__ = ["GooglePlaySource"]
