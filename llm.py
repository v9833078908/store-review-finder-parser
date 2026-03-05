"""Provider-agnostic LLM client via OpenRouter (OpenAI-compatible API).

All LLM calls go through ``call_llm(prompt, task, max_tokens)``.
The model is resolved per task from env vars with sensible defaults:

  Task                 Default model                    Env var override
  ─────────────────    ─────────────────────────────    ──────────────────
  theme_extraction     google/gemini-3-flash-preview     MODEL_THEMES
  classification       google/gemini-2.5-flash-lite      MODEL_CLASSIFY
  synthesis            google/gemini-3.1-pro-preview     MODEL_SYNTHESIS
  noise_gate           google/gemini-2.5-flash-lite      MODEL_NOISE_GATE
  community_classify   google/gemini-2.5-flash-lite      MODEL_COMMUNITY
  translation          google/gemini-2.5-flash-lite      MODEL_TRANSLATION
  default              google/gemini-3-flash-preview     LLM_MODEL

To override for all tasks, set ``LLM_MODEL``.
To fall back to stable models when preview is unstable:
  MODEL_THEMES=google/gemini-2.5-flash
  MODEL_SYNTHESIS=google/gemini-2.5-pro
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import time

from openai import AsyncOpenAI

from observability import (
    observe,
    update_current_generation,
    update_current_span,
)
from utils import log_event

MAX_API_RETRIES = 3

_TASK_DEFAULTS: dict[str, str] = {
    "theme_extraction": "google/gemini-3-flash-preview",
    "classification": "google/gemini-2.5-flash-lite",
    "synthesis": "google/gemini-3.1-pro-preview",
    "noise_gate": "google/gemini-2.5-flash-lite",
    "community_classify": "google/gemini-2.5-flash-lite",
    "translation": "google/gemini-2.5-flash-lite",
}

_TASK_ENV_VARS: dict[str, str] = {
    "theme_extraction": "MODEL_THEMES",
    "classification": "MODEL_CLASSIFY",
    "synthesis": "MODEL_SYNTHESIS",
    "noise_gate": "MODEL_NOISE_GATE",
    "community_classify": "MODEL_COMMUNITY",
    "translation": "MODEL_TRANSLATION",
}


def get_model_for_task(task: str) -> str:
    """Return the model name to use for a given pipeline task."""
    env_var = _TASK_ENV_VARS.get(task)
    if env_var:
        override = os.getenv(env_var)
        if override and override.strip():
            return override.strip()
    default = _TASK_DEFAULTS.get(task)
    if default:
        return default
    # global fallback
    return os.getenv("LLM_MODEL", "google/gemini-3-flash-preview") or "google/gemini-3-flash-preview"


def get_client() -> AsyncOpenAI:
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        raise RuntimeError("LLM_API_KEY is missing. Set it in .env or the environment.")
    base_url = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


@observe(name="llm_call", as_type="generation", capture_input=False, capture_output=False)
async def call_llm(
    prompt: str,
    task: str,
    max_tokens: int,
    temperature: float = 0.2,
    retries: int = MAX_API_RETRIES,
) -> str:
    """Call the LLM for the given task, returning the text response.

    Automatically selects the model based on *task* (see module docstring).
    Retries with exponential backoff on transient errors.
    """
    model = get_model_for_task(task)
    client = get_client()
    started = time.perf_counter()
    prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]

    log_event(
        "llm_call_started",
        provider="openrouter",
        model=model,
        task=task,
        prompt_chars=len(prompt),
        prompt_hash=prompt_hash,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    update_current_generation(
        name=f"llm:{task}",
        model=model,
        input={
            "task": task,
            "prompt_chars": len(prompt),
            "prompt_hash": prompt_hash,
        },
        metadata={
            "provider": "openrouter",
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        model_parameters={
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
    )

    for attempt in range(retries):
        try:
            attempt_started = time.perf_counter()
            response = await client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            text = (response.choices[0].message.content or "").strip()

            usage = response.usage
            usage_details: dict[str, int] = {}
            if usage:
                if usage.prompt_tokens:
                    usage_details["input_tokens"] = usage.prompt_tokens
                if usage.completion_tokens:
                    usage_details["output_tokens"] = usage.completion_tokens

            log_event(
                "llm_call_succeeded",
                provider="openrouter",
                model=model,
                task=task,
                attempt=attempt + 1,
                duration_ms=round((time.perf_counter() - attempt_started) * 1000),
                total_duration_ms=round((time.perf_counter() - started) * 1000),
                output_chars=len(text),
            )
            update_current_generation(
                output={
                    "output_chars": len(text),
                    "attempt": attempt + 1,
                },
                usage_details=usage_details or None,
                metadata={"provider": "openrouter", "task": task},
                status_message="succeeded",
            )
            return text

        except Exception as exc:
            attempt_duration = round((time.perf_counter() - attempt_started) * 1000)
            log_event(
                "llm_call_failed_attempt",
                provider="openrouter",
                model=model,
                task=task,
                attempt=attempt + 1,
                duration_ms=attempt_duration,
                error=str(exc),
            )
            update_current_span(
                metadata={
                    "provider": "openrouter",
                    "task": task,
                    "failed_attempt": attempt + 1,
                    "error": str(exc),
                }
            )
            if attempt == retries - 1:
                log_event(
                    "llm_call_failed",
                    provider="openrouter",
                    model=model,
                    task=task,
                    total_duration_ms=round((time.perf_counter() - started) * 1000),
                    retries=retries,
                )
                update_current_generation(
                    output={"error": str(exc)},
                    status_message="failed",
                    metadata={"provider": "openrouter", "task": task},
                )
                raise
            await asyncio.sleep(2**attempt)

    return ""
