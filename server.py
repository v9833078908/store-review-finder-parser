from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from datetime import date, datetime, time as dt_time, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from dashboard_config import load_dashboard_config, save_dashboard_config
from localization import localize_run_payload
from lead_scan import (
    ResolveInputError,
    ScanParams,
    normalize_country,
    resolve_google_play_input,
    run_catalog_scan,
)
from main import parse_google_play_url
from pipeline import run_unified_pipeline
from observability import init_observability, observe, shutdown_observability, update_current_trace
from report_builder import build_unified_report
from scraper import REGION_LANGUAGE_SWEEP, fetch_reviews
from storage import list_run_artifacts, load_run_artifact, save_run_artifact
from utils import log_event, safe_name
from version_tracker import get_current_version, get_previous_version, update_version_history

REPORTS_DIR = Path(__file__).resolve().parent / "reports"
SSE_POLL_SECONDS = 1.0
WINDOW_SAMPLE_LIMIT = 1000
WINDOW_FETCH_LIMIT = 5000
PERIOD_DAYS = {
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "90d": 90,
}
REGION_CODE_PATTERN = re.compile(r"^[a-z]{2}$")
ALL_REGION_CODE = "all"
ALL_REGION_SWEEP = [
    "us",  # USA — largest English market
    "jp",  # Japan — top mobile game market
    "kr",  # South Korea — top mobile game market
    "de",  # Germany — largest EU market
    "ru",  # Russia
    "gb",  # United Kingdom
    "in",  # India — fast-growing market
    "br",  # Brazil — largest LatAm market
    "fr",  # France
    "es",  # Spain
    "cn",  # China
    "it",  # Italy
    "ca",  # Canada
    "au",  # Australia
    "mx",  # Mexico
    "pl",  # Poland
    "nl",  # Netherlands
    "tr",  # Turkey — fast-growing mobile market
    "id",  # Indonesia — large mobile gaming market
    "se",  # Sweden — home of many game studios
]
ALL_REGION_FETCH_LIMIT_PER_COUNTRY = 500
PARALLEL_FETCH_CONCURRENCY = 5

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
    allow_methods=["GET", "PUT"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_observability() -> None:
    init_observability()


@app.on_event("shutdown")
async def _shutdown_observability() -> None:
    shutdown_observability()


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = uuid.uuid4().hex[:12]
    started = time.perf_counter()
    client_ip = request.client.host if request.client else None
    log_event(
        "http_request_started",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        query=request.url.query or "",
        client_ip=client_ip,
    )
    try:
        response = await call_next(request)
    except Exception as exc:
        log_event(
            "http_request_failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=round((time.perf_counter() - started) * 1000),
            error=str(exc),
        )
        raise

    response.headers["x-request-id"] = request_id
    log_event(
        "http_request_completed",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round((time.perf_counter() - started) * 1000),
    )
    return response


def _parse_langs(langs_raw: str) -> list[str]:
    langs = [item.strip() for item in langs_raw.split(",") if item.strip()]
    if not langs:
        raise ValueError("At least one language is required.")
    return langs


def _normalize_region(country: str) -> str:
    normalized = (country or "").strip().lower()
    if normalized == ALL_REGION_CODE:
        return normalized
    if not REGION_CODE_PATTERN.fullmatch(normalized):
        raise ValueError("country must be a two-letter region code (e.g. 'us') or 'all'.")
    return normalized


def _resolve_window(
    period: str | None,
    from_date: str | None,
    to_date: str | None,
) -> tuple[str | None, datetime | None, datetime | None]:
    if not period:
        return None, None, None

    now = datetime.now(timezone.utc)
    if period in PERIOD_DAYS:
        window_from = now - timedelta(days=PERIOD_DAYS[period])
        return period, window_from, now

    if period != "custom":
        raise ValueError("period must be one of: 7d, 14d, 30d, 90d, custom.")
    if not from_date or not to_date:
        raise ValueError("Custom period requires both 'from' and 'to' in YYYY-MM-DD format.")

    try:
        from_day = date.fromisoformat(from_date)
        to_day = date.fromisoformat(to_date)
    except ValueError as exc:
        raise ValueError("Invalid custom period date. Use YYYY-MM-DD.") from exc

    if from_day > to_day:
        raise ValueError("'from' date must be earlier than or equal to 'to' date.")

    window_from = datetime.combine(from_day, dt_time.min, tzinfo=timezone.utc)
    window_to = datetime.combine(to_day, dt_time.max, tzinfo=timezone.utc)
    return period, window_from, window_to


def _parse_review_date(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _filter_reviews_for_window(
    reviews: list[dict[str, Any]],
    window_from: datetime,
    window_to: datetime,
    sample_limit: int,
) -> list[dict[str, Any]]:
    selected: list[tuple[datetime, dict[str, Any]]] = []
    for review in reviews:
        dt = _parse_review_date(review.get("date"))
        if dt is None:
            continue
        if window_from <= dt <= window_to:
            selected.append((dt, review))

    selected.sort(key=lambda item: item[0], reverse=True)
    return [review for _, review in selected[:sample_limit]]


def _resolve_fetch_countries(normalized_country: str) -> list[str]:
    if normalized_country == ALL_REGION_CODE:
        return list(ALL_REGION_SWEEP)
    return [normalized_country]


def _merge_reviews_unique(reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_review_id: dict[str, tuple[datetime, dict[str, Any]]] = {}
    without_id: list[tuple[datetime, dict[str, Any]]] = []
    min_dt = datetime.min.replace(tzinfo=timezone.utc)

    for review in reviews:
        dt = _parse_review_date(review.get("date")) or min_dt
        review_id = str(review.get("review_id") or "").strip()
        if not review_id:
            without_id.append((dt, review))
            continue

        existing = by_review_id.get(review_id)
        if existing is None or dt > existing[0]:
            by_review_id[review_id] = (dt, review)

    merged = [payload for _, payload in by_review_id.values()]
    merged.extend(payload for _, payload in without_id)
    merged.sort(key=lambda item: _parse_review_date(item.get("date")) or min_dt, reverse=True)
    return merged


def _resolve_dashboard_params(
    url: str,
    max_reviews: int,
    langs_raw: str | None,
    country: str,
    period: str | None,
    from_date: str | None,
    to_date: str | None,
) -> tuple[str, str | None, datetime | None, datetime | None, list[str], int, list[str]]:
    """Normalise request parameters; return resolved fetch config."""
    normalized_country = _normalize_region(country)
    window_mode, window_from, window_to = _resolve_window(period, from_date, to_date)

    if window_mode:
        fetch_langs = REGION_LANGUAGE_SWEEP
        fetch_max_reviews = WINDOW_FETCH_LIMIT
    else:
        fetch_langs = _parse_langs(langs_raw or "en,ru")
        fetch_max_reviews = max_reviews

    fetch_countries = _resolve_fetch_countries(normalized_country)
    return normalized_country, window_mode, window_from, window_to, fetch_langs, fetch_max_reviews, fetch_countries


async def _fetch_all_reviews(
    package_name: str,
    fetch_countries: list[str],
    fetch_langs: list[str],
    fetch_max_reviews: int,
    normalized_country: str,
    window_mode: str | None,
    window_from: datetime | None,
    window_to: datetime | None,
    force_refresh: bool,
    cache_ttl_hours: int,
    _emit: Callable[[dict[str, Any]], Awaitable[None] | None],
) -> tuple[list[dict[str, Any]], dict[str, Any], str | None, str | None]:
    """Fetch reviews from all countries, merge, apply window filter.

    Returns (reviews, app_metadata, app_name_from_payload, fetched_at).
    """
    combined_reviews: list[dict[str, Any]] = []
    app_metadata: dict[str, Any] = {}
    app_name_from_payload: str | None = None

    if len(fetch_countries) > 1:
        await _emit(
            {
                "type": "status",
                "step": f"fetching:{len(fetch_countries)} countries in parallel",
            }
        )

    per_country_fetch_limit = fetch_max_reviews
    if normalized_country == ALL_REGION_CODE:
        if window_mode:
            per_country_fetch_limit = min(fetch_max_reviews, ALL_REGION_FETCH_LIMIT_PER_COUNTRY)
        else:
            per_country_fetch_limit = max(
                1,
                (fetch_max_reviews + len(fetch_countries) - 1) // len(fetch_countries),
            )

    sem = asyncio.Semaphore(PARALLEL_FETCH_CONCURRENCY)

    async def _fetch_one_country(fetch_country: str) -> dict[str, Any]:
        async with sem:
            started = time.perf_counter()
            payload = await asyncio.to_thread(
                fetch_reviews,
                package_name=package_name,
                max_reviews=per_country_fetch_limit,
                langs=fetch_langs,
                country=fetch_country,
                force_refresh=force_refresh,
                cache_ttl=timedelta(hours=cache_ttl_hours),
            )
            log_event(
                "reviews_fetch_completed",
                package_name=package_name,
                country=fetch_country,
                reviews=len(payload.get("reviews") or []),
                limit=per_country_fetch_limit,
                duration_ms=round((time.perf_counter() - started) * 1000),
                from_cache=bool(payload.get("cache_hit")),
            )
            return payload

    results = await asyncio.gather(
        *[_fetch_one_country(c) for c in fetch_countries],
        return_exceptions=True,
    )

    for result in results:
        if isinstance(result, Exception):
            log_event("reviews_fetch_country_error", error=str(result))
            continue
        country_reviews = result.get("reviews") or []
        combined_reviews.extend(country_reviews)
        if not app_metadata:
            app_metadata = result.get("app_metadata") or {}
        if not app_name_from_payload:
            app_name_from_payload = result.get("app_name")

    raw_reviews = _merge_reviews_unique(combined_reviews)
    log_event(
        "reviews_merged",
        package_name=package_name,
        before_merge=len(combined_reviews),
        after_merge=len(raw_reviews),
        countries_fetched=fetch_countries,
    )

    if not window_mode and len(raw_reviews) > fetch_max_reviews:
        raw_reviews = raw_reviews[:fetch_max_reviews]
    reviews = list(raw_reviews)

    if window_mode and window_from and window_to:
        pre_window_count = len(raw_reviews)
        reviews = _filter_reviews_for_window(
            reviews=raw_reviews,
            window_from=window_from,
            window_to=window_to,
            sample_limit=WINDOW_SAMPLE_LIMIT,
        )
        log_event(
            "reviews_window_filtered",
            package_name=package_name,
            window_mode=window_mode,
            window_from=window_from.isoformat(),
            window_to=window_to.isoformat(),
            before_filter=pre_window_count,
            after_filter=len(reviews),
            sample_limit=WINDOW_SAMPLE_LIMIT,
        )
        if not reviews:
            target_scope = "all regions" if normalized_country == ALL_REGION_CODE else f"region '{normalized_country}'"
            raise LookupError(
                f"No reviews found for {target_scope} in the selected window ({window_mode})."
            )

    fetched_at: str | None = next(
        (
            item.get("fetched_at")
            for item in results
            if not isinstance(item, Exception)
            and isinstance(item.get("fetched_at"), str)
            and item.get("fetched_at")
        ),
        None,
    )
    return reviews, app_metadata, app_name_from_payload, fetched_at


async def _run_pipeline_and_build_report(
    reviews: list[dict[str, Any]],
    app_name: str,
    app_metadata: dict[str, Any],
    package_name: str,
    window_mode: str | None,
    window_from: datetime | None,
    window_to: datetime | None,
    progress_callback: Callable[[dict[str, Any]], Awaitable[None] | None] | None,
) -> tuple[dict[str, Any], str, "Path", dict[str, Any] | None, dict[str, Any] | None]:
    """Run unified pipeline + build markdown.

    Returns (pipeline_result, markdown, report_path, current_version, previous_version).
    """
    update_version_history(package_name, app_metadata)
    current_version = get_current_version(package_name)
    previous_version = get_previous_version(package_name)
    changelog = app_metadata.get("recent_changes", "")

    pipeline_started = time.perf_counter()
    pipeline_result = await run_unified_pipeline(
        reviews=reviews,
        app_name=app_name,
        changelog=changelog,
        known_issues=[],
        current_version=current_version,
        previous_version=previous_version,
        progress_callback=progress_callback,
    )
    log_event(
        "pipeline_finished",
        run_id=pipeline_result.get("run_id"),
        package_name=package_name,
        duration_ms=round((time.perf_counter() - pipeline_started) * 1000),
        reviews=len(reviews),
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
    report_path = REPORTS_DIR / f"{safe_name(app_name, fallback='report')}_dashboard_{date_label}.md"
    report_path.write_text(markdown, encoding="utf-8")
    return pipeline_result, markdown, report_path, current_version, previous_version


def _save_and_log_result(
    *,
    pipeline_result: dict[str, Any],
    markdown: str,
    report_path: "Path",
    package_name: str,
    app_name: str,
    fetch_langs: list[str],
    fetch_countries: list[str],
    normalized_country: str,
    app_metadata: dict[str, Any],
    fetched_at: str | None,
    current_version: dict[str, Any] | None,
    previous_version: dict[str, Any] | None,
    window_mode: str | None,
    window_from: datetime | None,
    window_to: datetime | None,
    max_reviews: int,
    reviews: list[dict[str, Any]],
    source: str,
    selected_app_id: str | None,
    url: str,
    started: float,
) -> dict[str, Any]:
    """Save artifact, emit completion logs, and return the SSE report payload."""
    artifact_path = save_run_artifact(
        package_name=package_name,
        app_name=app_name,
        artifact={
            "run_id": pipeline_result["run_id"],
            "fetched_at": fetched_at,
            "langs": fetch_langs,
            "country": normalized_country,
            "countries_fetched": fetch_countries,
            "app_metadata": app_metadata,
            "current_version": current_version,
            "previous_version": previous_version,
            "stats": pipeline_result["stats"],
            "themes": pipeline_result["themes"],
            "classified": pipeline_result["classified"],
            "alerts": pipeline_result["alerts"],
            "category_counts": pipeline_result["category_counts"],
            "synthesis_markdown": pipeline_result["synthesis_markdown"],
            "report_layers": pipeline_result["report_layers"],
            "model": pipeline_result["model"],
            "prompt_versions": pipeline_result["prompt_versions"],
            "report_path": str(report_path),
            "source": "api",
            "feedback_source": "google_play",
            "dashboard_config_snapshot": load_dashboard_config(package_name, "producer"),
            "launch_context": {
                "source": source,
                "selected_app_id": selected_app_id,
                "input_url": url,
            },
            "window_mode": window_mode or "legacy",
            "window_from": window_from.isoformat() if window_from else None,
            "window_to": window_to.isoformat() if window_to else None,
            "sample_limit": WINDOW_SAMPLE_LIMIT if window_mode else max_reviews,
            "reviews_selected": len(reviews),
            "reviews": reviews,
        },
    )
    duration_ms = round((time.perf_counter() - started) * 1000)
    log_event(
        "dashboard_generation_completed",
        run_id=pipeline_result.get("run_id"),
        package_name=package_name,
        app_name=app_name,
        report_path=str(report_path),
        artifact_path=str(artifact_path),
        reviews_selected=len(reviews),
        duration_ms=duration_ms,
    )
    update_current_trace(
        session_id=pipeline_result.get("run_id"),
        metadata={
            "run_id": pipeline_result.get("run_id"),
            "package_name": package_name,
            "app_name": app_name,
            "country": normalized_country,
            "countries_fetched": fetch_countries,
            "window_mode": window_mode or "legacy",
            "window_from": window_from.isoformat() if window_from else None,
            "window_to": window_to.isoformat() if window_to else None,
            "sample_limit": WINDOW_SAMPLE_LIMIT if window_mode else max_reviews,
            "reviews_selected": len(reviews),
            "duration_ms": duration_ms,
        },
        tags=[
            f"source:{source}",
            f"country:{normalized_country}",
            f"window:{window_mode or 'legacy'}",
        ],
    )
    return {
        "run_id": pipeline_result["run_id"],
        "package_name": package_name,
        "app_name": app_name,
        "report_path": str(report_path),
        "artifact_path": str(artifact_path),
        "markdown": markdown,
        "report_layers": pipeline_result["report_layers"],
        "stats": pipeline_result["stats"],
        "category_counts": pipeline_result["category_counts"],
        "alerts_count": len(pipeline_result["alerts"]),
        "window_mode": window_mode or "legacy",
        "window_from": window_from.isoformat() if window_from else None,
        "window_to": window_to.isoformat() if window_to else None,
        "sample_limit": WINDOW_SAMPLE_LIMIT if window_mode else max_reviews,
        "reviews_selected": len(reviews),
    }


@observe(name="generate_dashboard", capture_input=False, capture_output=False)
async def _generate_dashboard(
    *,
    url: str,
    max_reviews: int,
    langs_raw: str | None,
    country: str,
    period: str | None,
    from_date: str | None,
    to_date: str | None,
    force_refresh: bool,
    cache_ttl_hours: int,
    source: str,
    selected_app_id: str | None,
    progress_callback: Callable[[dict[str, Any]], Awaitable[None] | None] | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    normalized_country, window_mode, window_from, window_to, fetch_langs, fetch_max_reviews, fetch_countries = (
        _resolve_dashboard_params(url, max_reviews, langs_raw, country, period, from_date, to_date)
    )
    update_current_trace(
        name="dashboard_generation",
        metadata={
            "source": source,
            "selected_app_id": selected_app_id,
            "country": normalized_country,
            "period": period or "legacy",
            "window_mode": window_mode or "legacy",
            "window_from": window_from.isoformat() if window_from else None,
            "window_to": window_to.isoformat() if window_to else None,
            "force_refresh": force_refresh,
        },
        tags=["dashboard", "report-generation"],
    )
    log_event(
        "dashboard_generation_started",
        source=source,
        app_id=selected_app_id,
        country=normalized_country,
        countries_fetched=fetch_countries,
        period=period or "legacy",
        window_mode=window_mode or "legacy",
        window_from=window_from.isoformat() if window_from else None,
        window_to=window_to.isoformat() if window_to else None,
        fetch_max_reviews=fetch_max_reviews,
        sample_limit=WINDOW_SAMPLE_LIMIT if window_mode else max_reviews,
    )

    package_name, resolved_title = parse_google_play_url(
        url,
        country=fetch_countries[0],
        lang=fetch_langs[0],
    )

    async def _emit(event: dict[str, Any]) -> None:
        if not progress_callback:
            return
        maybe_awaitable = progress_callback(event)
        if asyncio.iscoroutine(maybe_awaitable):
            await maybe_awaitable

    await _emit({"type": "status", "step": "resolved", "package": package_name, "title": resolved_title})
    await _emit({"type": "status", "step": "fetching"})

    reviews, app_metadata, app_name_from_payload, fetched_at = await _fetch_all_reviews(
        package_name=package_name,
        fetch_countries=fetch_countries,
        fetch_langs=fetch_langs,
        fetch_max_reviews=fetch_max_reviews,
        normalized_country=normalized_country,
        window_mode=window_mode,
        window_from=window_from,
        window_to=window_to,
        force_refresh=force_refresh,
        cache_ttl_hours=cache_ttl_hours,
        _emit=_emit,
    )
    app_name = str(app_name_from_payload or package_name)

    await _emit({"type": "status", "step": "fetched", "count": len(reviews)})
    log_event(
        "reviews_ready_for_pipeline",
        package_name=package_name,
        selected_reviews=len(reviews),
        window_mode=window_mode or "legacy",
    )

    pipeline_result, markdown, report_path, current_version, previous_version = (
        await _run_pipeline_and_build_report(
            reviews=reviews,
            app_name=app_name,
            app_metadata=app_metadata,
            package_name=package_name,
            window_mode=window_mode,
            window_from=window_from,
            window_to=window_to,
            progress_callback=progress_callback,
        )
    )

    return _save_and_log_result(
        pipeline_result=pipeline_result,
        markdown=markdown,
        report_path=report_path,
        package_name=package_name,
        app_name=app_name,
        fetch_langs=fetch_langs,
        fetch_countries=fetch_countries,
        normalized_country=normalized_country,
        app_metadata=app_metadata,
        fetched_at=fetched_at,
        current_version=current_version,
        previous_version=previous_version,
        window_mode=window_mode,
        window_from=window_from,
        window_to=window_to,
        max_reviews=max_reviews,
        reviews=reviews,
        source=source,
        selected_app_id=selected_app_id,
        url=url,
        started=started,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/report/sync")
async def report_sync(
    url: str = Query(..., description="Google Play URL or package name"),
    max_reviews: int = Query(300, ge=1, le=5000),
    langs: str = Query("en,ru"),
    country: str = Query(..., min_length=2, max_length=8),
    period: str | None = Query(None, pattern="^(7d|14d|30d|90d|custom)$"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    force_refresh: bool = Query(False),
    cache_ttl_hours: int = Query(1, ge=1, le=168),
    source: str = Query("direct_url", pattern="^(direct_url|catalog)$"),
    app_id: str | None = Query(None),
) -> dict[str, Any]:
    try:
        return await _generate_dashboard(
            url=url,
            max_reviews=max_reviews,
            langs_raw=langs,
            country=country,
            period=period,
            from_date=from_date,
            to_date=to_date,
            force_refresh=force_refresh,
            cache_ttl_hours=cache_ttl_hours,
            source=source,
            selected_app_id=app_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/report")
async def report_sse(
    request: Request,
    url: str = Query(..., description="Google Play URL or package name"),
    max_reviews: int = Query(300, ge=1, le=5000),
    langs: str = Query("en,ru"),
    country: str = Query(..., min_length=2, max_length=8),
    period: str | None = Query(None, pattern="^(7d|14d|30d|90d|custom)$"),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
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
                period=period,
                from_date=from_date,
                to_date=to_date,
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


@app.get("/api/runs")
async def list_runs(
    package_name: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    unique_apps: bool = Query(False),
) -> dict[str, Any]:
    items = list_run_artifacts(package_name=package_name, limit=limit, unique_apps=unique_apps)
    return {"items": items, "count": len(items)}


@app.get("/api/runs/{run_id}")
async def get_run(
    run_id: str,
    lang: str = Query("en"),
) -> dict[str, Any]:
    payload = load_run_artifact(run_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    locale = (lang or "en").strip().lower()
    if locale.startswith("ru"):
        try:
            payload = await localize_run_payload(payload, "ru")
        except Exception as exc:
            log_event(
                "run_localization_failed",
                run_id=run_id,
                locale="ru",
                error=str(exc),
            )
    return payload


@app.get("/api/dashboard-config")
async def get_dashboard_config(
    package_name: str = Query(..., min_length=1),
    role_profile: str = Query("producer"),
) -> dict[str, Any]:
    try:
        return load_dashboard_config(package_name, role_profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/dashboard-config")
async def put_dashboard_config(
    package_name: str = Query(..., min_length=1),
    role_profile: str = Query("producer"),
    payload: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    try:
        return save_dashboard_config(package_name, role_profile, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
