from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Awaitable, Callable

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from lead_scan import (
    ResolveInputError,
    ScanParams,
    normalize_country,
    resolve_google_play_input,
    run_catalog_scan,
)
from main import parse_google_play_url
from pipeline import run_unified_pipeline
from report_builder import build_unified_report
from scraper import fetch_reviews
from storage import load_run_artifact, save_run_artifact
from version_tracker import get_current_version, get_previous_version, update_version_history

REPORTS_DIR = Path(__file__).resolve().parent / "reports"
SSE_POLL_SECONDS = 1.0

app = FastAPI(title="Review Dashboard API", version="0.1.0")

raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:51100,http://127.0.0.1:51100,http://localhost:51200,http://127.0.0.1:51200",
)
cors_origins = [item.strip() for item in raw_origins.split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _safe_report_name(value: str) -> str:
    import re

    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", value.strip())
    cleaned = cleaned.strip("_")
    return cleaned or "report"


def _parse_langs(langs_raw: str) -> list[str]:
    langs = [item.strip() for item in langs_raw.split(",") if item.strip()]
    if not langs:
        raise ValueError("At least one language is required.")
    return langs


async def _generate_dashboard(
    *,
    url: str,
    max_reviews: int,
    langs_raw: str,
    country: str,
    force_refresh: bool,
    cache_ttl_hours: int,
    source: str,
    selected_app_id: str | None,
    progress_callback: Callable[[dict[str, Any]], Awaitable[None] | None] | None = None,
) -> dict[str, Any]:
    langs = _parse_langs(langs_raw)
    package_name, resolved_title = parse_google_play_url(url, country=country, lang=langs[0])

    async def _emit(event: dict[str, Any]) -> None:
        if not progress_callback:
            return
        maybe_awaitable = progress_callback(event)
        if asyncio.iscoroutine(maybe_awaitable):
            await maybe_awaitable

    await _emit(
        {
            "type": "status",
            "step": "resolved",
            "package": package_name,
            "title": resolved_title,
        }
    )
    await _emit({"type": "status", "step": "fetching"})

    payload = await asyncio.to_thread(
        fetch_reviews,
        package_name=package_name,
        max_reviews=max_reviews,
        langs=langs,
        country=country,
        force_refresh=force_refresh,
        cache_ttl=timedelta(hours=cache_ttl_hours),
    )
    reviews = payload.get("reviews") or []
    app_metadata = payload.get("app_metadata") or {}
    app_name = payload.get("app_name") or package_name

    await _emit({"type": "status", "step": "fetched", "count": len(reviews)})

    update_version_history(package_name, app_metadata)
    current_version = get_current_version(package_name)
    previous_version = get_previous_version(package_name)
    changelog = app_metadata.get("recent_changes", "")

    pipeline_result = await run_unified_pipeline(
        reviews=reviews,
        app_name=app_name,
        changelog=changelog,
        known_issues=[],
        current_version=current_version,
        previous_version=previous_version,
        progress_callback=progress_callback,
    )

    markdown = build_unified_report(
        app_name=app_name,
        stats=pipeline_result["stats"],
        themes=pipeline_result["themes"],
        alerts=pipeline_result["alerts"],
        category_counts=pipeline_result["category_counts"],
        synthesis_markdown=pipeline_result["synthesis_markdown"],
        current_version=current_version,
        previous_version=previous_version,
        run_id=pipeline_result["run_id"],
    )

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    date_label = datetime.now().strftime("%Y-%m-%d")
    report_path = REPORTS_DIR / f"{_safe_report_name(app_name)}_dashboard_{date_label}.md"
    report_path.write_text(markdown, encoding="utf-8")

    artifact_path = save_run_artifact(
        package_name=package_name,
        app_name=app_name,
        artifact={
            "run_id": pipeline_result["run_id"],
            "fetched_at": payload.get("fetched_at"),
            "langs": payload.get("langs") or langs,
            "country": payload.get("country") or country,
            "app_metadata": app_metadata,
            "current_version": current_version,
            "previous_version": previous_version,
            "stats": pipeline_result["stats"],
            "themes": pipeline_result["themes"],
            "classified": pipeline_result["classified"],
            "alerts": pipeline_result["alerts"],
            "category_counts": pipeline_result["category_counts"],
            "synthesis_markdown": pipeline_result["synthesis_markdown"],
            "model": pipeline_result["model"],
            "prompt_versions": pipeline_result["prompt_versions"],
            "report_path": str(report_path),
            "source": "api",
            "launch_context": {
                "source": source,
                "selected_app_id": selected_app_id,
                "input_url": url,
            },
            "reviews": reviews,
        },
    )

    return {
        "run_id": pipeline_result["run_id"],
        "package_name": package_name,
        "app_name": app_name,
        "report_path": str(report_path),
        "artifact_path": str(artifact_path),
        "markdown": markdown,
        "stats": pipeline_result["stats"],
        "category_counts": pipeline_result["category_counts"],
        "alerts_count": len(pipeline_result["alerts"]),
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/report/sync")
async def report_sync(
    url: str = Query(..., description="Google Play URL or package name"),
    max_reviews: int = Query(300, ge=1, le=5000),
    langs: str = Query("en,ru"),
    country: str = Query("us"),
    force_refresh: bool = Query(False),
    cache_ttl_hours: int = Query(1, ge=1, le=168),
    source: str = Query("direct_url", pattern="^(direct_url|catalog)$"),
    app_id: str | None = Query(None),
) -> dict[str, Any]:
    return await _generate_dashboard(
        url=url,
        max_reviews=max_reviews,
        langs_raw=langs,
        country=country,
        force_refresh=force_refresh,
        cache_ttl_hours=cache_ttl_hours,
        source=source,
        selected_app_id=app_id,
    )


@app.get("/api/report")
async def report_sse(
    request: Request,
    url: str = Query(..., description="Google Play URL or package name"),
    max_reviews: int = Query(300, ge=1, le=5000),
    langs: str = Query("en,ru"),
    country: str = Query("us"),
    force_refresh: bool = Query(False),
    cache_ttl_hours: int = Query(1, ge=1, le=168),
    source: str = Query("direct_url", pattern="^(direct_url|catalog)$"),
    app_id: str | None = Query(None),
) -> EventSourceResponse:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def _progress(event: dict[str, Any]) -> None:
        await queue.put(event)

    async def _worker() -> None:
        try:
            result = await _generate_dashboard(
                url=url,
                max_reviews=max_reviews,
                langs_raw=langs,
                country=country,
                force_refresh=force_refresh,
                cache_ttl_hours=cache_ttl_hours,
                source=source,
                selected_app_id=app_id,
                progress_callback=_progress,
            )
            await queue.put({"type": "report", "data": result})
        except asyncio.CancelledError:
            await queue.put({"type": "error", "message": "Request cancelled"})
            raise
        except Exception as exc:
            await queue.put({"type": "error", "message": str(exc)})
        finally:
            await queue.put({"type": "done"})

    async def _event_generator():
        worker_task = asyncio.create_task(_worker())
        try:
            while True:
                if await request.is_disconnected():
                    worker_task.cancel()
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=SSE_POLL_SECONDS)
                except asyncio.TimeoutError:
                    continue

                yield {"data": json.dumps(event, ensure_ascii=False)}
                if event.get("type") == "done":
                    break
        finally:
            if not worker_task.done():
                worker_task.cancel()

    return EventSourceResponse(_event_generator())


@app.get("/api/scan/sync")
async def scan_sync(
    collection: str = Query("TOP_FREE"),
    category: str | None = Query(None),
    country: str = Query("us"),
    lang: str = Query("en"),
    maxApps: int = Query(50, ge=1, le=500),
    maxReviews: int = Query(200, ge=1, le=1000),
    windowDays: int = Query(365, ge=1, le=3650),
    minAgeDays: int = Query(0, ge=0, le=365),
) -> dict[str, Any]:
    params = ScanParams(
        collection=collection,
        category=category,
        country=country,
        lang=lang,
        max_apps=maxApps,
        max_reviews=maxReviews,
        window_days=windowDays,
        min_age_days=minAgeDays,
    )
    results, total_errors = await asyncio.to_thread(run_catalog_scan, params)
    return {
        "results": results,
        "totalProcessed": len(results),
        "totalErrors": total_errors,
        "country": normalize_country(country),
    }


@app.get("/api/scan")
async def scan_sse(
    request: Request,
    collection: str = Query("TOP_FREE"),
    category: str | None = Query(None),
    country: str = Query("us"),
    lang: str = Query("en"),
    maxApps: int = Query(50, ge=1, le=500),
    maxReviews: int = Query(200, ge=1, le=1000),
    windowDays: int = Query(365, ge=1, le=3650),
    minAgeDays: int = Query(0, ge=0, le=365),
) -> EventSourceResponse:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    params = ScanParams(
        collection=collection,
        category=category,
        country=country,
        lang=lang,
        max_apps=maxApps,
        max_reviews=maxReviews,
        window_days=windowDays,
        min_age_days=minAgeDays,
    )

    async def _worker() -> None:
        loop = asyncio.get_running_loop()

        def _progress(event: dict[str, Any]) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, event)

        try:
            results, total_errors = await asyncio.to_thread(run_catalog_scan, params, _progress)
            await queue.put(
                {
                    "type": "done",
                    "totalProcessed": len(results),
                    "totalErrors": total_errors,
                    "country": normalize_country(country),
                }
            )
        except asyncio.CancelledError:
            await queue.put({"type": "error", "message": "Scan cancelled"})
            await queue.put({"type": "done", "totalProcessed": 0, "totalErrors": 1})
            raise
        except Exception as exc:
            await queue.put({"type": "error", "message": f"Fatal error: {exc}"})
            await queue.put({"type": "done", "totalProcessed": 0, "totalErrors": 1})

    async def _event_generator():
        worker_task = asyncio.create_task(_worker())
        try:
            while True:
                if await request.is_disconnected():
                    worker_task.cancel()
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=SSE_POLL_SECONDS)
                except asyncio.TimeoutError:
                    continue
                yield {"data": json.dumps(event, ensure_ascii=False)}
                if event.get("type") == "done":
                    break
        finally:
            if not worker_task.done():
                worker_task.cancel()

    return EventSourceResponse(_event_generator())


@app.get("/api/resolve/google-play")
async def resolve_google_play(
    input: str = Query(..., min_length=1),
    country: str = Query("us"),
    lang: str = Query("en"),
    limit: int = Query(5, ge=1, le=10),
) -> dict[str, Any]:
    try:
        return await asyncio.to_thread(resolve_google_play_input, input, country, lang, limit)
    except ResolveInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    payload = load_run_artifact(run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    return payload
