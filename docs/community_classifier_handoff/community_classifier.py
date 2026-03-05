"""
Two-pass community chat classifier pipeline.
Standalone version — no dependencies on review-parser internals.

Pass 1 (noise gate): thread-aware binary filter — signal vs noise.
Pass 2 (topic classifier): classify signal messages with thread context.

Usage:
    python community_classifier.py data.csv -o output.json --chat-id "-100123456"

Requires:
    pip install anthropic
    ANTHROPIC_API_KEY env var (or .env file in same directory)
"""

from __future__ import annotations

import asyncio
import csv
import hashlib
import json
import logging
import os
import re
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

THREAD_GAP_SECONDS = 300      # 5-min gap splits threads
THREAD_CONTEXT_WINDOW = 5     # messages of context around target
NOISE_GATE_BATCH_SIZE = 40    # messages per LLM call (pass 1)
CLASSIFY_BATCH_SIZE = 30      # messages per LLM call (pass 2)
MAX_CONCURRENCY = 4           # parallel API calls
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("community_classifier")


# ---------------------------------------------------------------------------
# LLM utilities (self-contained, no external deps beyond anthropic)
# ---------------------------------------------------------------------------

def _load_env() -> None:
    """Load .env from current dir or parent if present."""
    for candidate in [Path(".env"), Path("../.env")]:
        if candidate.exists():
            with open(candidate) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        os.environ.setdefault(key.strip(), val.strip())
            break


def get_client_and_model():
    """Create Anthropic async client."""
    from anthropic import AsyncAnthropic

    _load_env()
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. "
            "Export it or create a .env file with ANTHROPIC_API_KEY=sk-..."
        )
    model = os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    logger.info(f"Using model: {model}")
    return AsyncAnthropic(api_key=api_key), model


def load_prompt(filename: str) -> str:
    """Load prompt template from prompts/ directory."""
    path = PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Prompt file not found: {path}\n"
            f"Make sure the 'prompts/' directory is next to this script."
        )
    content = path.read_text(encoding="utf-8")
    logger.info(f"Loaded prompt: {filename} ({len(content)} chars)")
    return content


async def call_model(
    client: Any,
    model: str,
    prompt: str,
    max_tokens: int = 4000,
    temperature: float = 0.2,
    retries: int = 3,
) -> str:
    """Call Claude API with retry logic."""
    for attempt in range(retries):
        try:
            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            chunks = [
                block.text
                for block in response.content
                if getattr(block, "type", "") == "text"
            ]
            return "".join(chunks).strip()
        except Exception as exc:
            logger.warning(f"API call failed (attempt {attempt+1}/{retries}): {exc}")
            if attempt == retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)
    return ""


def extract_json_text(text: str) -> str:
    """Extract JSON array/object from LLM response."""
    stripped = text.strip()
    if stripped.startswith("[") or stripped.startswith("{"):
        return stripped

    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL)
    if fenced:
        return fenced.group(1).strip()

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        return text[start : end + 1]

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return text[start : end + 1]

    raise ValueError("No JSON found in model response.")


def to_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def chunked(items: list, size: int) -> list[list]:
    return [items[i : i + size] for i in range(0, len(items), size)]


# ---------------------------------------------------------------------------
# CSV loading (supports multiple column naming conventions)
# ---------------------------------------------------------------------------

# Map internal field name → list of possible CSV column headers.
# Add your own column names here if your CSV uses different headers.
FIELD_MAP = {
    "text":                ["comment_text", "Текст комментария", "text", "message", "content", "body"],
    "timestamp":           ["created_at", "Дата и время", "timestamp", "date", "datetime", "sent_at"],
    "user_id":             ["user_id", "ID пользователя", "author_id", "sender_id"],
    "username":            ["username", "Имя пользователя", "author", "nick", "handle"],
    "display_name":        ["first_name", "Имя", "display_name", "name", "author_name"],
    "chat_id":             ["chat_id", "ID чата", "channel_id", "server_id", "guild_id"],
    "chat_type":           ["chat_type", "Тип чата", "channel_type"],
    "original_tag":        ["tag", "Тег", "label", "category"],
    "original_confidence": ["confidence", "Уверенность", "score"],
}


def _get_field(row: dict, field: str) -> str:
    """Get field value trying multiple possible column names."""
    for header in FIELD_MAP[field]:
        val = row.get(header)
        if val is not None:
            return str(val).strip()
    return ""


def load_community_csv(path: str | Path) -> list[dict[str, Any]]:
    """Load community chat CSV export. Auto-detects column names."""
    rows: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        logger.info(f"CSV columns: {reader.fieldnames}")
        for i, row in enumerate(reader):
            text = _get_field(row, "text")
            if not text:
                continue
            rows.append({
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
            })
    rows.sort(key=lambda r: r["timestamp"])
    logger.info(f"Loaded {len(rows)} messages from {path}")
    return rows


# ---------------------------------------------------------------------------
# Thread grouping
# ---------------------------------------------------------------------------

def _parse_ts(value: str) -> datetime:
    """Parse timestamp, tries common formats."""
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
    ):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse timestamp: {value}")


def group_into_threads(
    messages: list[dict[str, Any]],
    gap_seconds: int = THREAD_GAP_SECONDS,
) -> list[list[dict[str, Any]]]:
    """Split chronological messages into threads by time gap."""
    if not messages:
        return []

    threads: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = [messages[0]]

    for msg in messages[1:]:
        prev = current[-1]
        try:
            gap = (_parse_ts(msg["timestamp"]) - _parse_ts(prev["timestamp"])).total_seconds()
        except (ValueError, TypeError):
            gap = gap_seconds + 1

        same_chat = msg["chat_id"] == prev["chat_id"]

        if same_chat and gap <= gap_seconds:
            current.append(msg)
        else:
            threads.append(current)
            current = [msg]

    if current:
        threads.append(current)

    sizes = [len(t) for t in threads]
    logger.info(
        f"Grouped into {len(threads)} threads "
        f"(avg {sum(sizes)/max(len(sizes),1):.1f}, "
        f"median {sorted(sizes)[len(sizes)//2]}, "
        f"max {max(sizes)})"
    )
    return threads


# ---------------------------------------------------------------------------
# Batch building with thread context
# ---------------------------------------------------------------------------

def _format_message(msg: dict[str, Any], is_target: bool = False) -> dict[str, str]:
    result = {
        "msg_id": msg["msg_id"],
        "username": msg["username"] or msg["display_name"],
        "text": msg["text"][:500],
    }
    if is_target:
        result["classify"] = "true"
    return result


def build_threaded_batches(
    threads: list[list[dict[str, Any]]],
    batch_size: int,
    context_window: int = THREAD_CONTEXT_WINDOW,
) -> list[list[dict[str, Any]]]:
    """Build batches where each item has thread context + target message."""
    items: list[dict[str, Any]] = []
    for thread in threads:
        for i, msg in enumerate(thread):
            start = max(0, i - context_window)
            items.append({
                "msg_id": msg["msg_id"],
                "thread_context": [_format_message(m) for m in thread[start:i]],
                "target": _format_message(msg, is_target=True),
                "_original": msg,
            })
    return chunked(items, batch_size)


def _build_thread_lookup(
    threads: list[list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    lookup: dict[str, list[dict[str, Any]]] = {}
    for thread in threads:
        for msg in thread:
            lookup[msg["msg_id"]] = thread
    return lookup


# ---------------------------------------------------------------------------
# Pass 1: Noise Gate
# ---------------------------------------------------------------------------

async def _noise_gate_batch(
    client: Any, model: str, batch: list[dict[str, Any]], prompt_template: str,
) -> list[dict[str, Any]]:
    messages_for_prompt = [
        {"msg_id": item["msg_id"], "context": item["thread_context"], "message": item["target"]}
        for item in batch
    ]
    prompt = prompt_template.replace("{{MESSAGES_JSON}}", to_json(messages_for_prompt))
    raw = await call_model(client, model, prompt)
    parsed = json.loads(extract_json_text(raw))

    if not isinstance(parsed, list):
        raise ValueError("Noise gate: expected JSON array")

    results_by_id = {}
    for item in parsed:
        if isinstance(item, dict) and "msg_id" in item:
            results_by_id[str(item["msg_id"])] = {
                "label": item.get("label", "noise"),
                "confidence": float(item.get("confidence", 0.5)),
            }

    output = []
    for item in batch:
        mid = item["msg_id"]
        gate = results_by_id.get(mid, {"label": "noise", "confidence": 0.0})
        output.append({
            **item["_original"],
            "gate_label": gate["label"],
            "gate_confidence": gate["confidence"],
        })
    return output


async def run_noise_gate(
    client: Any, model: str, threads: list[list[dict[str, Any]]],
    semaphore: asyncio.Semaphore,
) -> list[dict[str, Any]]:
    prompt_template = load_prompt("community_noise_gate.txt")
    batches = build_threaded_batches(threads, NOISE_GATE_BATCH_SIZE)
    total = len(batches)

    async def _guarded(batch):
        async with semaphore:
            return await _noise_gate_batch(client, model, batch, prompt_template)

    results: list[dict[str, Any]] = []
    tasks = [asyncio.create_task(_guarded(b)) for b in batches]
    for i, task in enumerate(asyncio.as_completed(tasks), 1):
        results.extend(await task)
        if i % 10 == 0 or i == total:
            logger.info(f"  Noise gate: {i}/{total} batches done")

    signal = sum(1 for r in results if r["gate_label"] == "signal")
    logger.info(f"Noise gate complete: {signal} signal / {len(results)-signal} noise")
    return results


# ---------------------------------------------------------------------------
# Pass 2: Topic Classification
# ---------------------------------------------------------------------------

async def _classify_batch(
    client: Any, model: str, batch: list[dict[str, Any]],
    prompt_template: str, threads_lookup: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    messages_for_prompt = []
    for msg in batch:
        thread = threads_lookup.get(msg["msg_id"], [])
        idx = next((i for i, m in enumerate(thread) if m["msg_id"] == msg["msg_id"]), 0)
        start = max(0, idx - THREAD_CONTEXT_WINDOW)
        context = [_format_message(m) for m in thread[start:idx]]
        messages_for_prompt.append({
            "msg_id": msg["msg_id"],
            "context": context,
            "message": _format_message(msg, is_target=True),
        })

    prompt = prompt_template.replace("{{MESSAGES_JSON}}", to_json(messages_for_prompt))
    raw = await call_model(client, model, prompt)
    parsed = json.loads(extract_json_text(raw))

    if not isinstance(parsed, list):
        raise ValueError("Classifier: expected JSON array")

    results_by_id = {}
    for item in parsed:
        if isinstance(item, dict) and "msg_id" in item:
            results_by_id[str(item["msg_id"])] = item

    output = []
    for msg in batch:
        cls = results_by_id.get(msg["msg_id"], {})
        output.append({
            **msg,
            "topic": cls.get("topic", "unknown"),
            "topic_secondary": cls.get("topic_secondary"),
            "sentiment": cls.get("sentiment", "neutral"),
            "classify_confidence": float(cls.get("confidence", 0.5)),
            "summary": cls.get("summary", ""),
        })
    return output


async def run_classification(
    client: Any, model: str, signal_messages: list[dict[str, Any]],
    threads: list[list[dict[str, Any]]], semaphore: asyncio.Semaphore,
) -> list[dict[str, Any]]:
    if not signal_messages:
        return []

    prompt_template = load_prompt("community_classify.txt")
    threads_lookup = _build_thread_lookup(threads)
    batches = chunked(signal_messages, CLASSIFY_BATCH_SIZE)
    total = len(batches)

    async def _guarded(batch):
        async with semaphore:
            return await _classify_batch(client, model, batch, prompt_template, threads_lookup)

    results: list[dict[str, Any]] = []
    tasks = [asyncio.create_task(_guarded(b)) for b in batches]
    for i, task in enumerate(asyncio.as_completed(tasks), 1):
        results.extend(await task)
        if i % 10 == 0 or i == total:
            logger.info(f"  Classify: {i}/{total} batches done")

    return results


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

async def run_community_pipeline(
    csv_path: str | Path,
    output_path: str | Path | None = None,
    chat_id: str | None = None,
) -> dict[str, Any]:
    """Run the full two-pass community classification pipeline."""
    client, model = get_client_and_model()
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    # Load
    messages = load_community_csv(csv_path)
    if chat_id:
        messages = [m for m in messages if m["chat_id"] == chat_id]
    logger.info(f"Pipeline started: {len(messages)} messages")

    # Thread
    threads = group_into_threads(messages)

    # Pass 1
    print(f"\n[Pass 1] Noise gate: {len(messages)} messages in {len(threads)} threads...")
    gated = await run_noise_gate(client, model, threads, semaphore)
    signal_messages = [m for m in gated if m["gate_label"] == "signal"]
    noise_messages = [m for m in gated if m["gate_label"] == "noise"]
    print(f"  Signal: {len(signal_messages)} | Noise: {len(noise_messages)}")

    # Pass 2
    print(f"\n[Pass 2] Classifying {len(signal_messages)} signal messages...")
    classified = await run_classification(client, model, signal_messages, threads, semaphore)

    # Summary
    topic_counts = Counter(m["topic"] for m in classified)
    sentiment_counts = Counter(m["sentiment"] for m in classified)

    summary = {
        "total_messages": len(messages),
        "total_threads": len(threads),
        "signal_count": len(signal_messages),
        "noise_count": len(noise_messages),
        "signal_pct": round(len(signal_messages) / max(len(messages), 1) * 100, 1),
        "topic_distribution": dict(topic_counts.most_common()),
        "sentiment_distribution": dict(sentiment_counts.most_common()),
        "avg_gate_confidence": round(
            sum(m["gate_confidence"] for m in gated) / max(len(gated), 1), 3
        ),
        "avg_classify_confidence": round(
            sum(m["classify_confidence"] for m in classified) / max(len(classified), 1), 3
        ),
    }

    # Write output
    result = {
        "summary": summary,
        "classified": classified,
        "noise": [
            {"msg_id": m["msg_id"], "text": m["text"][:200], "gate_confidence": m["gate_confidence"]}
            for m in noise_messages
        ],
    }

    if output_path is None:
        output_path = Path("community_classified.json")
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Print summary
    print(f"\n{'='*50}")
    print(f"PIPELINE SUMMARY")
    print(f"{'='*50}")
    print(f"Total messages:     {summary['total_messages']}")
    print(f"Threads:            {summary['total_threads']}")
    print(f"Signal:             {summary['signal_count']} ({summary['signal_pct']}%)")
    print(f"Noise:              {summary['noise_count']}")
    print(f"Avg gate conf:      {summary['avg_gate_confidence']}")
    print(f"Avg classify conf:  {summary['avg_classify_confidence']}")
    print(f"\nTopic distribution:")
    for topic, count in topic_counts.most_common():
        print(f"  {topic:20s} {count:5d}")
    print(f"\nSentiment distribution:")
    for sent, count in sentiment_counts.most_common():
        print(f"  {sent:10s} {count:5d}")
    print(f"\nResults saved to {output_path}")

    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Two-pass community chat classifier (noise gate + topic classification)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Telegram chat
  python community_classifier.py telegram_export.csv -o results.json

  # Filter specific chat/channel
  python community_classifier.py data.csv --chat-id "-100123456" -o results.json

  # Discord export (DiscordChatExporter CSV)
  python community_classifier.py discord_export.csv -o results.json
        """,
    )
    parser.add_argument("csv_path", help="Path to CSV with chat messages")
    parser.add_argument("--output", "-o", help="Output JSON path (default: community_classified.json)")
    parser.add_argument("--chat-id", help="Filter to specific chat/channel ID")
    args = parser.parse_args()

    asyncio.run(run_community_pipeline(args.csv_path, args.output, args.chat_id))
