"""Full two-pass community classification pipeline and CLI entry point."""

from __future__ import annotations

import asyncio
import json
from collections import Counter
from pathlib import Path
from typing import Any

from config import DEFAULT_MAX_CONCURRENCY
from utils import log_event

from community.classifiers import run_noise_gate, run_topic_classification
from community.loader import load_community_csv
from community.threads import group_into_threads


async def run_community_pipeline(
    csv_path: str | Path,
    output_path: str | Path | None = None,
    chat_id: str | None = None,
) -> dict[str, Any]:
    """Run the full two-pass community classification pipeline.

    Returns summary stats and writes results to JSON.
    """
    semaphore = asyncio.Semaphore(DEFAULT_MAX_CONCURRENCY)

    messages = load_community_csv(csv_path)
    if chat_id:
        messages = [m for m in messages if m["chat_id"] == chat_id]
    log_event("pipeline_started", total_messages=len(messages))

    threads = group_into_threads(messages)

    print(f"[Pass 1] Noise gate: {len(messages)} messages in {len(threads)} threads...")
    gated = await run_noise_gate(threads, semaphore)
    signal_messages = [m for m in gated if m["gate_label"] == "signal"]
    noise_messages = [m for m in gated if m["gate_label"] == "noise"]
    print(f"  → Signal: {len(signal_messages)} | Noise: {len(noise_messages)}")

    print(f"[Pass 2] Classifying {len(signal_messages)} signal messages...")
    classified = await run_topic_classification(signal_messages, threads, semaphore)

    topic_counts = Counter(m["topic"] for m in classified)
    sentiment_counts = Counter(m["sentiment"] for m in classified)

    summary: dict[str, Any] = {
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

    result: dict[str, Any] = {
        "summary": summary,
        "classified": classified,
        "noise": [
            {
                "msg_id": m["msg_id"],
                "text": m["text"][:200],
                "gate_confidence": m["gate_confidence"],
            }
            for m in noise_messages
        ],
    }

    if output_path is None:
        output_path = Path("data") / "community_classified.json"
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    print(f"\nResults saved to {output_path}")

    print(f"\n{'='*50}")
    print("PIPELINE SUMMARY")
    print(f"{'='*50}")
    print(f"Total messages:     {summary['total_messages']}")
    print(f"Threads:            {summary['total_threads']}")
    print(f"Signal:             {summary['signal_count']} ({summary['signal_pct']}%)")
    print(f"Noise:              {summary['noise_count']}")
    print(f"Avg gate conf:      {summary['avg_gate_confidence']}")
    print(f"Avg classify conf:  {summary['avg_classify_confidence']}")
    print("\nTopic distribution:")
    for topic, count in topic_counts.most_common():
        print(f"  {topic:20s} {count:5d}")
    print("\nSentiment distribution:")
    for sent, count in sentiment_counts.most_common():
        print(f"  {sent:10s} {count:5d}")

    return summary


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Community chat classifier pipeline")
    parser.add_argument("csv_path", help="Path to Telegram CSV export")
    parser.add_argument("--output", "-o", help="Output JSON path", default=None)
    parser.add_argument("--chat-id", help="Filter to specific chat ID", default=None)
    args = parser.parse_args()

    asyncio.run(run_community_pipeline(args.csv_path, args.output, args.chat_id))
