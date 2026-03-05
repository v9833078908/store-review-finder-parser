"""Two-pass LLM classifiers for community messages.

Pass 1 — noise_gate: binary signal/noise filter.
Pass 2 — topic_classify: classify signal messages into product taxonomy.

Both classifiers accept *topics* as a parameter so the taxonomy can be
customised per game without modifying source code.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from config import (
    COMMUNITY_CLASSIFY_BATCH_SIZE,
    DEFAULT_MAX_CONCURRENCY,
    NOISE_GATE_BATCH_SIZE,
    THREAD_CONTEXT_WINDOW,
)
from llm import call_llm
from utils import ProgressCallback, extract_json_text, load_prompt, log_event, run_batched, to_json
from community.threads import (
    _format_message,
    build_thread_lookup,
    build_threaded_items,
)


# ---------------------------------------------------------------------------
# Pass 1: Noise Gate
# ---------------------------------------------------------------------------

async def _noise_gate_batch(
    batch: list[dict[str, Any]],
    prompt_template: str,
) -> list[dict[str, Any]]:
    messages_for_prompt = [
        {
            "msg_id": item["msg_id"],
            "context": item["thread_context"],
            "message": item["target"],
        }
        for item in batch
    ]
    prompt = prompt_template.replace("{{MESSAGES_JSON}}", to_json(messages_for_prompt))
    raw = await call_llm(prompt, task="noise_gate", max_tokens=4000)
    parsed = json.loads(extract_json_text(raw))

    if not isinstance(parsed, list):
        raise ValueError("Noise gate: expected JSON array")

    results_by_id: dict[str, dict[str, Any]] = {}
    for item in parsed:
        if isinstance(item, dict) and "msg_id" in item:
            results_by_id[str(item["msg_id"])] = {
                "label": item.get("label", "noise"),
                "confidence": float(item.get("confidence", 0.5)),
            }

    output: list[dict[str, Any]] = []
    for item in batch:
        mid = item["msg_id"]
        gate = results_by_id.get(mid, {"label": "noise", "confidence": 0.0})
        output.append(
            {
                **item["_original"],
                "gate_label": gate["label"],
                "gate_confidence": gate["confidence"],
            }
        )
    return output


async def run_noise_gate(
    threads: list[list[dict[str, Any]]],
    semaphore: asyncio.Semaphore,
    batch_size: int = NOISE_GATE_BATCH_SIZE,
    progress_callback: ProgressCallback | None = None,
) -> list[dict[str, Any]]:
    """Run noise gate across all threaded messages."""
    prompt_template = load_prompt("community_noise_gate.txt")
    flat_items = build_threaded_items(threads)
    results = await run_batched(
        items=flat_items,
        batch_size=batch_size,
        processor=lambda batch: _noise_gate_batch(batch, prompt_template),
        semaphore=semaphore,
        progress_callback=progress_callback,
    )
    signal = [r for r in results if r["gate_label"] == "signal"]
    noise = [r for r in results if r["gate_label"] == "noise"]
    log_event(
        "noise_gate_complete",
        total=len(results),
        signal=len(signal),
        noise=len(noise),
        signal_pct=round(len(signal) / max(len(results), 1) * 100, 1),
    )
    return results


# ---------------------------------------------------------------------------
# Pass 2: Topic Classification
# ---------------------------------------------------------------------------

async def _classify_batch(
    batch: list[dict[str, Any]],
    prompt_template: str,
    threads_lookup: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    messages_for_prompt = []
    for msg in batch:
        thread = threads_lookup.get(msg["msg_id"], [])
        idx = next((i for i, m in enumerate(thread) if m["msg_id"] == msg["msg_id"]), 0)
        start = max(0, idx - THREAD_CONTEXT_WINDOW)
        context = [_format_message(m) for m in thread[start:idx]]
        messages_for_prompt.append(
            {
                "msg_id": msg["msg_id"],
                "context": context,
                "message": _format_message(msg, is_target=True),
            }
        )

    prompt = prompt_template.replace("{{MESSAGES_JSON}}", to_json(messages_for_prompt))
    raw = await call_llm(prompt, task="community_classify", max_tokens=4000)
    parsed = json.loads(extract_json_text(raw))

    if not isinstance(parsed, list):
        raise ValueError("Classifier: expected JSON array")

    results_by_id = {
        str(item["msg_id"]): item
        for item in parsed
        if isinstance(item, dict) and "msg_id" in item
    }
    output: list[dict[str, Any]] = []
    for msg in batch:
        cls = results_by_id.get(msg["msg_id"], {})
        output.append(
            {
                **msg,
                "topic": cls.get("topic", "unknown"),
                "topic_secondary": cls.get("topic_secondary"),
                "sentiment": cls.get("sentiment", "neutral"),
                "classify_confidence": float(cls.get("confidence", 0.5)),
                "summary": cls.get("summary", ""),
            }
        )
    return output


async def run_topic_classification(
    signal_messages: list[dict[str, Any]],
    threads: list[list[dict[str, Any]]],
    semaphore: asyncio.Semaphore,
    batch_size: int = COMMUNITY_CLASSIFY_BATCH_SIZE,
    progress_callback: ProgressCallback | None = None,
) -> list[dict[str, Any]]:
    """Classify signal messages into the product topic taxonomy."""
    if not signal_messages:
        return []

    prompt_template = load_prompt("community_classify.txt")
    threads_lookup = build_thread_lookup(threads)
    results = await run_batched(
        items=signal_messages,
        batch_size=batch_size,
        processor=lambda batch: _classify_batch(batch, prompt_template, threads_lookup),
        semaphore=semaphore,
        progress_callback=progress_callback,
    )
    log_event("classification_complete", total_classified=len(results))
    return results
