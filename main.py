from __future__ import annotations

import argparse
import asyncio
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from google_play_scraper import search as gp_search
from google_play_scraper.constants.element import ElementSpec, ElementSpecs

from dashboard_config import load_dashboard_config
from observability import init_observability, shutdown_observability
from pipeline import run_unified_pipeline
from report_builder import build_unified_report
from scraper import fetch_reviews
from storage import save_run_artifact
from utils import safe_name
from version_tracker import get_current_version, get_previous_version, update_version_history

REPORTS_DIR = Path(__file__).resolve().parent / "reports"
ALERTS_DIR = REPORTS_DIR / "alerts"
TOP_RESULT_APP_ID_ALT_PATH = [3, "12", 0, 0]
_SEARCH_APP_ID_PATCHED = False


def _ensure_search_top_result_appid_patch() -> None:
    """Patch google-play-scraper top-result appId extraction for promoted cards."""
    global _SEARCH_APP_ID_PATCHED
    if _SEARCH_APP_ID_PATCHED:
        return

    spec = ElementSpecs.SearchResultOnTop.get("appId")
    if isinstance(spec, ElementSpec):
        ElementSpecs.SearchResultOnTop["appId"] = ElementSpec(
            spec.ds_num,
            list(spec.data_map),
            spec.post_processor,
            fallback_value=ElementSpec(
                None,
                list(TOP_RESULT_APP_ID_ALT_PATH),
                fallback_value=spec.fallback_value,
            ),
        )

    _SEARCH_APP_ID_PATCHED = True


def parse_google_play_url(url: str, country: str = "us", lang: str = "en") -> tuple[str, str | None]:
    _ensure_search_top_result_appid_patch()
    package_pattern = re.compile(r"^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$")
    if package_pattern.fullmatch(url):
        return url, None

    parsed = urlparse(url)
    if parsed.netloc not in {"play.google.com", "www.play.google.com", ""}:
        raise ValueError("Expected a Google Play URL, e.g. https://play.google.com/store/apps/details?id=<package>")

    if parsed.path.rstrip("/") == "/store/search":
        query = parse_qs(parsed.query).get("q", [""])[0].strip()
        if not query:
            raise ValueError("Google Play search URL must include a non-empty q parameter.")

        results = gp_search(query, lang=lang, country=country, n_hits=10)
        if not results:
            raise ValueError(f"No apps found for search query: {query}")

        for item in results:
            app_id = item.get("appId")
            if not app_id:
                item_url = item.get("url") or ""
                url_id = parse_qs(urlparse(item_url).query).get("id", [None])[0]
                if url_id and package_pattern.fullmatch(url_id):
                    app_id = url_id
            if app_id and package_pattern.fullmatch(app_id):
                return app_id, str(item.get("title") or "")

        first_title = results[0].get("title") if results else None
        if first_title:
            retry_results = gp_search(first_title, lang=lang, country=country, n_hits=5)
            for item in retry_results:
                app_id = item.get("appId")
                if app_id and package_pattern.fullmatch(app_id):
                    return app_id, str(item.get("title") or "")

        raise ValueError(f"No valid appId found for search query: {query}")

    package_name = parse_qs(parsed.query).get("id", [None])[0]
    if not package_name or not package_pattern.fullmatch(package_name):
        raise ValueError("Could not extract package name from URL.")
    return package_name, None


def _safe_report_name(value: str) -> str:
    return safe_name(value, fallback="report")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a unified dashboard report from Google Play reviews.")
    parser.add_argument("url", help="Google Play game URL or package name")
    parser.add_argument("--max-reviews", type=int, default=2000, help="Maximum number of reviews to analyze")
    parser.add_argument("--langs", default="en,ru", help="Comma-separated languages (default: en,ru)")
    parser.add_argument("--country", default="us", help="Google Play country code (default: us)")
    parser.add_argument(
        "--mode",
        choices=["unified", "report", "alert"],
        default="unified",
        help="Unified pipeline mode. report/alert are deprecated aliases.",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Bypass local review cache and fetch fresh data from Google Play.",
    )
    parser.add_argument(
        "--cache-ttl-hours",
        type=int,
        default=None,
        help="Override cache TTL hours for this run.",
    )
    return parser.parse_args()


def _resolve_mode(mode: str) -> tuple[str, str | None]:
    if mode in {"report", "alert"}:
        return "unified", mode
    return mode, None


def _report_destination(app_name: str, legacy_mode: str | None) -> Path:
    date_label = datetime.now().strftime("%Y-%m-%d")
    if legacy_mode == "alert":
        ALERTS_DIR.mkdir(parents=True, exist_ok=True)
        return ALERTS_DIR / f"{_safe_report_name(app_name)}_alert_{date_label}.md"
    if legacy_mode == "report":
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        return REPORTS_DIR / f"{_safe_report_name(app_name)}_{date_label}.md"

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return REPORTS_DIR / f"{_safe_report_name(app_name)}_dashboard_{date_label}.md"


async def _run_dashboard_mode(
    package_name: str,
    max_reviews: int,
    langs: list[str],
    country: str,
    legacy_mode: str | None,
    force_refresh: bool,
    cache_ttl_hours: int,
) -> None:
    print(f"[1/5] Fetching reviews for package: {package_name}", file=sys.stderr)
    payload = fetch_reviews(
        package_name=package_name,
        max_reviews=max_reviews,
        langs=langs,
        country=country,
        force_refresh=force_refresh,
        cache_ttl=timedelta(hours=cache_ttl_hours),
    )

    app_name = payload.get("app_name") or package_name
    reviews = payload.get("reviews") or []
    app_metadata = payload.get("app_metadata") or {}

    update_version_history(package_name, app_metadata)
    current_version = get_current_version(package_name)
    previous_version = get_previous_version(package_name)
    changelog = app_metadata.get("recent_changes", "")

    async def _progress(event: dict) -> None:
        if event.get("type") == "progress":
            pipeline_name = event.get("pipeline")
            current = event.get("current")
            total = event.get("total")
            print(f"[2/5] {pipeline_name}: {current}/{total}", file=sys.stderr)

    print(f"[2/5] Running unified pipeline for {len(reviews)} reviews", file=sys.stderr)
    pipeline_result = await run_unified_pipeline(
        reviews=reviews,
        app_name=app_name,
        changelog=changelog,
        known_issues=[],
        current_version=current_version,
        previous_version=previous_version,
        progress_callback=_progress,
    )

    print("[3/5] Building markdown report", file=sys.stderr)
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

    report_path = _report_destination(app_name, legacy_mode)
    report_path.write_text(markdown, encoding="utf-8")

    print("[4/5] Saving structured run artifact", file=sys.stderr)
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
            "report_layers": pipeline_result["report_layers"],
            "model": pipeline_result["model"],
            "prompt_versions": pipeline_result["prompt_versions"],
            "report_path": str(report_path),
            "legacy_mode": legacy_mode,
            "feedback_source": "google_play",
            "dashboard_config_snapshot": load_dashboard_config(package_name, "producer"),
            "reviews": reviews,
        },
    )

    print(f"[5/5] Report saved: {report_path}", file=sys.stderr)
    print(f"Run artifact saved: {artifact_path}", file=sys.stderr)
    print(report_path)


async def main() -> None:
    args = _parse_args()
    load_dotenv()
    init_observability()

    if args.max_reviews <= 0:
        raise SystemExit("--max-reviews must be greater than zero.")

    langs = [item.strip() for item in args.langs.split(",") if item.strip()]
    if not langs:
        raise SystemExit("At least one language is required, e.g. --langs en,ru")

    package_name, resolved_title = parse_google_play_url(args.url, country=args.country, lang=langs[0])
    if resolved_title:
        print(f"Resolved search URL to app: {resolved_title} ({package_name})", file=sys.stderr)

    resolved_mode, legacy_mode = _resolve_mode(args.mode)
    if legacy_mode:
        print(
            f"Deprecated: --mode {legacy_mode} now maps to unified pipeline. "
            "Use --mode unified.",
            file=sys.stderr,
        )

    cache_ttl_hours = args.cache_ttl_hours
    if cache_ttl_hours is None:
        cache_ttl_hours = 24 if legacy_mode == "report" else 1
    if cache_ttl_hours <= 0:
        raise SystemExit("--cache-ttl-hours must be > 0")

    if resolved_mode == "unified":
        await _run_dashboard_mode(
            package_name=package_name,
            max_reviews=args.max_reviews,
            langs=langs,
            country=args.country,
            legacy_mode=legacy_mode,
            force_refresh=args.force_refresh,
            cache_ttl_hours=cache_ttl_hours,
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
    finally:
        shutdown_observability()
