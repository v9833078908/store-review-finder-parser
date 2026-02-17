from __future__ import annotations

import logging
import os
import threading
from typing import Any, Callable, TypeVar, overload

LOGGER = logging.getLogger("review_parser.observability")

_INIT_LOCK = threading.Lock()
_INITIALIZED = False

try:
    from langfuse import get_client as _langfuse_get_client
    from langfuse import observe as _langfuse_observe
except Exception as exc:  # pragma: no cover - import errors are environment-specific
    _langfuse_get_client = None
    _langfuse_observe = None
    LOGGER.debug("Langfuse SDK is not available: %s", exc)


F = TypeVar("F", bound=Callable[..., Any])


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _get_client():
    if _langfuse_get_client is None:
        return None
    try:
        return _langfuse_get_client()
    except Exception as exc:  # pragma: no cover - network and credentials can fail
        LOGGER.warning("Failed to create Langfuse client: %s", exc)
        return None


def init_observability() -> None:
    global _INITIALIZED

    with _INIT_LOCK:
        if _INITIALIZED:
            return
        _INITIALIZED = True

        client = _get_client()
        if client is None:
            LOGGER.info("Langfuse is disabled: client was not initialized.")
            return

        LOGGER.info("Langfuse client initialized.")
        if _env_flag("LANGFUSE_AUTH_CHECK_ON_STARTUP", default=False):
            try:
                auth_ok = bool(client.auth_check())
            except Exception as exc:  # pragma: no cover - external service call
                LOGGER.warning("Langfuse auth_check failed: %s", exc)
            else:
                LOGGER.info("Langfuse auth_check passed: %s", auth_ok)

        if not _env_flag("LANGFUSE_ANTHROPIC_OTEL_ENABLED", default=True):
            return

        try:
            from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor

            AnthropicInstrumentor().instrument()
            LOGGER.info("Anthropic OpenTelemetry instrumentation enabled.")
        except Exception as exc:  # pragma: no cover - optional dependency
            LOGGER.warning("Anthropic instrumentation skipped: %s", exc)


def shutdown_observability() -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.shutdown()
    except Exception as exc:  # pragma: no cover - shutdown safety
        LOGGER.warning("Langfuse shutdown failed: %s", exc)


def current_trace_id() -> str | None:
    client = _get_client()
    if client is None:
        return None
    try:
        return client.get_current_trace_id()
    except Exception:
        return None


def update_current_trace(**kwargs: Any) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.update_current_trace(**kwargs)
    except Exception as exc:  # pragma: no cover - tracing is best-effort
        LOGGER.debug("update_current_trace skipped: %s", exc)


def update_current_span(**kwargs: Any) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.update_current_span(**kwargs)
    except Exception as exc:  # pragma: no cover - tracing is best-effort
        LOGGER.debug("update_current_span skipped: %s", exc)


def update_current_generation(**kwargs: Any) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.update_current_generation(**kwargs)
    except Exception as exc:  # pragma: no cover - tracing is best-effort
        LOGGER.debug("update_current_generation skipped: %s", exc)


@overload
def observe(func: F) -> F:
    ...


@overload
def observe(
    func: None = None,
    *,
    name: str | None = None,
    as_type: str | None = None,
    capture_input: bool | None = None,
    capture_output: bool | None = None,
) -> Callable[[F], F]:
    ...


def observe(func: F | None = None, **kwargs: Any):
    if _langfuse_observe is None:
        if func is None:
            def _decorator(inner: F) -> F:
                return inner

            return _decorator
        return func

    if func is None:
        return _langfuse_observe(**kwargs)
    return _langfuse_observe(func, **kwargs)
