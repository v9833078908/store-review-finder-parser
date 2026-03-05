"""Backward-compatible re-export shim for community_classifier.

The implementation has moved to the community/ package.
Existing callers that import from this module continue to work unchanged.
"""

from community.classifiers import run_noise_gate, run_topic_classification as run_classification
from community.loader import load_community_csv
from community.pipeline import run_community_pipeline
from community.threads import (
    _parse_ts,
    build_thread_lookup as _build_thread_lookup,
    build_threaded_batches,
    build_threaded_items,
    group_into_threads,
)

# Re-export constants that callers may reference directly
from config import (
    COMMUNITY_CLASSIFY_BATCH_SIZE as CLASSIFY_BATCH_SIZE,
    DEFAULT_MAX_CONCURRENCY as MAX_CONCURRENCY,
    NOISE_GATE_BATCH_SIZE,
    THREAD_CONTEXT_WINDOW,
    THREAD_GAP_SECONDS,
)

__all__ = [
    "load_community_csv",
    "group_into_threads",
    "build_threaded_batches",
    "build_threaded_items",
    "run_noise_gate",
    "run_classification",
    "run_community_pipeline",
    "THREAD_GAP_SECONDS",
    "THREAD_CONTEXT_WINDOW",
    "NOISE_GATE_BATCH_SIZE",
    "CLASSIFY_BATCH_SIZE",
    "MAX_CONCURRENCY",
]


if __name__ == "__main__":
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="Community chat classifier pipeline")
    parser.add_argument("csv_path", help="Path to Telegram CSV export")
    parser.add_argument("--output", "-o", help="Output JSON path", default=None)
    parser.add_argument("--chat-id", help="Filter to specific chat ID", default=None)
    args = parser.parse_args()

    asyncio.run(run_community_pipeline(args.csv_path, args.output, args.chat_id))
