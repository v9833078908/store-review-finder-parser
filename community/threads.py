"""Thread grouping for Telegram community messages."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from config import THREAD_CONTEXT_WINDOW, THREAD_GAP_SECONDS
from utils import chunked, log_event


def _parse_ts(value: str) -> datetime:
    """Parse timestamp with or without microseconds."""
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse timestamp: {value}")


def group_into_threads(
    messages: list[dict[str, Any]],
    gap_seconds: int = THREAD_GAP_SECONDS,
) -> list[list[dict[str, Any]]]:
    """Split messages into threads by time gap within the same chat."""
    if not messages:
        return []

    threads: list[list[dict[str, Any]]] = []
    current_thread: list[dict[str, Any]] = [messages[0]]

    for msg in messages[1:]:
        prev = current_thread[-1]
        try:
            t_prev = _parse_ts(prev["timestamp"])
            t_curr = _parse_ts(msg["timestamp"])
            gap = (t_curr - t_prev).total_seconds()
        except (ValueError, TypeError):
            gap = gap_seconds + 1

        same_chat = msg["chat_id"] == prev["chat_id"]
        if same_chat and gap <= gap_seconds:
            current_thread.append(msg)
        else:
            threads.append(current_thread)
            current_thread = [msg]

    if current_thread:
        threads.append(current_thread)

    log_event(
        "threads_grouped",
        total_threads=len(threads),
        avg_thread_size=round(sum(len(t) for t in threads) / max(len(threads), 1), 1),
    )
    return threads


def _format_message(msg: dict[str, Any], is_target: bool = False) -> dict[str, str]:
    """Compact message representation for prompts, marking classify targets."""
    result: dict[str, str] = {
        "msg_id": msg["msg_id"],
        "username": msg["username"] or msg["display_name"],
        "text": msg["text"][:500],
    }
    if is_target:
        result["classify"] = "true"
    return result


def build_threaded_items(
    threads: list[list[dict[str, Any]]],
    context_window: int = THREAD_CONTEXT_WINDOW,
) -> list[dict[str, Any]]:
    """Build flat list of messages with surrounding thread context.

    Each item contains:
    - the target message (marked classify=true)
    - up to *context_window* preceding messages from the same thread
    """
    items: list[dict[str, Any]] = []
    for thread in threads:
        for i, msg in enumerate(thread):
            start = max(0, i - context_window)
            context_msgs = thread[start:i]
            items.append(
                {
                    "msg_id": msg["msg_id"],
                    "thread_context": [_format_message(m) for m in context_msgs],
                    "target": _format_message(msg, is_target=True),
                    "_original": msg,
                }
            )
    return items


def build_threaded_batches(
    threads: list[list[dict[str, Any]]],
    batch_size: int,
    context_window: int = THREAD_CONTEXT_WINDOW,
) -> list[list[dict[str, Any]]]:
    """Return pre-chunked batches of threaded items."""
    return chunked(build_threaded_items(threads, context_window), batch_size)


def build_thread_lookup(
    threads: list[list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    """Map msg_id → its full thread for context reconstruction."""
    lookup: dict[str, list[dict[str, Any]]] = {}
    for thread in threads:
        for msg in thread:
            lookup[msg["msg_id"]] = thread
    return lookup
