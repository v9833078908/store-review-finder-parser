from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

YANDEX_GAMES_URL_RE = re.compile(r"^https://yandex\.ru/games/app/(?P<app_id>\d+)(?:[/?#].*)?$")


def extract_yandex_games_app_id(url: str) -> str:
    match = YANDEX_GAMES_URL_RE.match(str(url or "").strip())
    if not match:
        raise ValueError("Expected a direct Yandex Games URL like https://yandex.ru/games/app/<id>")
    return match.group("app_id")


def _parse_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    return parsed.isoformat()


def normalize_yandex_games_review(raw: dict[str, Any]) -> dict[str, Any]:
    lang = str(raw.get("language") or "ru").strip().lower() or "ru"
    return {
        "review_id": str(raw.get("id") or ""),
        "date": _parse_timestamp(str(raw.get("createdAt") or "")),
        "rating": int(raw.get("rating") or 0),
        "text": str(raw.get("text") or "").strip(),
        "version": None,
        "thumbs_up": 0,
        "original_lang": lang,
        "lang": lang,
        "has_reply": False,
        "reply_text": None,
        "reply_date": None,
    }
