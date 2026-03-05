"""Load and normalise Telegram community CSV exports."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from utils import log_event

# Column name mapping: canonical_name → [possible CSV headers]
_FIELD_MAP: dict[str, list[str]] = {
    "text": ["comment_text", "Текст комментария"],
    "timestamp": ["created_at", "Дата и время"],
    "user_id": ["user_id", "ID пользователя"],
    "username": ["username", "Имя пользователя"],
    "display_name": ["first_name", "Имя"],
    "chat_id": ["chat_id", "ID чата"],
    "chat_type": ["chat_type", "Тип чата"],
    "original_tag": ["tag", "Тег"],
    "original_confidence": ["confidence", "Уверенность"],
}


def _get_field(row: dict[str, str], field: str) -> str:
    for header in _FIELD_MAP[field]:
        val = row.get(header)
        if val is not None:
            return str(val).strip()
    return ""


def load_community_csv(path: str | Path) -> list[dict[str, Any]]:
    """Load Telegram export CSV and normalise fields.

    Supports two formats:
    - Legacy (Russian headers): Дата и время, Текст комментария, etc.
    - New (English headers): created_at, comment_text, etc.

    Returns messages sorted by timestamp (ascending).
    """
    rows: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader):
            text = _get_field(row, "text")
            if not text:
                continue
            rows.append(
                {
                    "msg_id": row.get("id", str(i)),
                    "timestamp": _get_field(row, "timestamp"),
                    "user_id": _get_field(row, "user_id"),
                    "username": _get_field(row, "username"),
                    "display_name": _get_field(row, "display_name"),
                    "chat_id": _get_field(row, "chat_id"),
                    "chat_type": _get_field(row, "chat_type"),
                    "text": text,
                    "original_tag": _get_field(row, "original_tag"),
                    "original_confidence": _get_field(row, "original_confidence"),
                }
            )

    rows.sort(key=lambda r: r["timestamp"])
    log_event("community_csv_loaded", total_messages=len(rows), path=str(path))
    return rows
