from __future__ import annotations

import json
import math
import re
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from google_play_scraper import Sort, app as gp_app, reviews as gp_reviews, search as gp_search

COLLECTIONS = {"TOP_FREE", "TOP_PAID", "GROSSING"}
SUPPORTED_COUNTRIES = {
    "us",
    "gb",
    "de",
    "fr",
    "es",
    "it",
    "jp",
    "kr",
    "cn",
    "in",
    "br",
    "ca",
    "au",
    "mx",
    "nl",
    "se",
    "no",
    "dk",
    "fi",
    "pl",
}

MAX_RETRIES = 3
PAGE_DELAY_SECONDS = 0.5
APP_DELAY_SECONDS = 1.0
MAX_PAGE_SIZE = 150

BRIDGE_SCRIPT = Path(__file__).resolve().parent / "scripts" / "gplay_bridge.mjs"
PACKAGE_PATTERN = re.compile(r"^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$")


@dataclass
class ScanParams:
    collection: str = "TOP_FREE"
    category: str | None = None
    country: str = "us"
    lang: str = "en"
    max_apps: int = 50
    max_reviews: int = 200
    window_days: int = 365
    min_age_days: int = 0


class LeadScanError(RuntimeError):
    pass


class ResolveInputError(ValueError):
    pass


def normalize_country(country: str) -> str:
    normalized = (country or "us").strip().lower()
    return normalized if normalized in SUPPORTED_COUNTRIES else "us"


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _run_bridge(payload: dict[str, Any]) -> dict[str, Any]:
    if not BRIDGE_SCRIPT.exists():
        raise LeadScanError(f"Bridge script is missing: {BRIDGE_SCRIPT}")

    command = ["node", str(BRIDGE_SCRIPT), json.dumps(payload)]
    process = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
        cwd=str(Path(__file__).resolve().parent),
    )

    if process.returncode != 0:
        stderr = (process.stderr or "").strip()
        raise LeadScanError(
            "Failed to fetch catalog list via Node bridge. "
            f"Command: {' '.join(command)}. Error: {stderr or 'unknown'}"
        )

    stdout = (process.stdout or "").strip()
    if not stdout:
        raise LeadScanError("Bridge returned an empty response.")

    try:
        parsed = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise LeadScanError(f"Bridge returned invalid JSON: {stdout[:500]}") from exc

    if not isinstance(parsed, dict):
        raise LeadScanError("Bridge response must be a JSON object.")

    return parsed


def fetch_top_apps(collection: str, category: str | None, country: str, lang: str, num: int) -> list[str]:
    normalized_collection = (collection or "TOP_FREE").upper()
    if normalized_collection not in COLLECTIONS:
        raise LeadScanError(f"Invalid collection: {collection}")

    payload = {
        "mode": "list",
        "collection": normalized_collection,
        "category": category,
        "country": normalize_country(country),
        "lang": (lang or "en").strip().lower() or "en",
        "num": max(1, min(int(num), 500)),
    }
    result = _run_bridge(payload)
    app_ids = result.get("appIds")
    if not isinstance(app_ids, list):
        raise LeadScanError("Bridge response does not include appIds list.")

    cleaned = [item for item in app_ids if isinstance(item, str) and PACKAGE_PATTERN.fullmatch(item)]
    return cleaned


def _retryable_app_details(app_id: str, lang: str, country: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            return gp_app(app_id, lang=lang, country=country)
        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(2**attempt)
    raise LeadScanError(f"Failed to fetch app details for {app_id}: {last_error}")


def fetch_app_details(app_id: str, lang: str, country: str) -> dict[str, Any]:
    details = _retryable_app_details(app_id, lang, country)
    return {
        "appId": details.get("appId") or app_id,
        "title": details.get("title") or app_id,
        "developer": details.get("developer") or "Unknown",
        "developerEmail": details.get("developerEmail") or None,
        "score": float(details.get("score") or 0),
        "reviews": int(details.get("reviews") or 0),
        "url": details.get("url") or f"https://play.google.com/store/apps/details?id={app_id}",
    }


def _retryable_reviews_page(
    *,
    app_id: str,
    lang: str,
    country: str,
    count: int,
    continuation_token: Any,
) -> tuple[list[dict[str, Any]], Any]:
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            return gp_reviews(
                app_id,
                lang=lang,
                country=country,
                sort=Sort.NEWEST,
                count=count,
                continuation_token=continuation_token,
            )
        except Exception as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(2**attempt)
    raise LeadScanError(f"Failed to fetch reviews for {app_id}: {last_error}")


def fetch_reviews(app_id: str, lang: str, country: str, max_reviews: int) -> list[dict[str, Any]]:
    reviews: list[dict[str, Any]] = []
    continuation_token = None

    while len(reviews) < max_reviews:
        count = min(MAX_PAGE_SIZE, max_reviews - len(reviews))
        page, continuation_token = _retryable_reviews_page(
            app_id=app_id,
            lang=lang,
            country=country,
            count=count,
            continuation_token=continuation_token,
        )

        if not page:
            break

        for item in page:
            created_at = item.get("at")
            replied_at = item.get("repliedAt")
            reviews.append(
                {
                    "id": str(item.get("reviewId") or ""),
                    "date": created_at if isinstance(created_at, datetime) else datetime.now(),
                    "score": _safe_int(item.get("score"), 0),
                    "text": str(item.get("content") or ""),
                    "replyDate": replied_at if isinstance(replied_at, datetime) else None,
                }
            )

        if not continuation_token or len(reviews) >= max_reviews:
            break

        time.sleep(PAGE_DELAY_SECONDS)

    return reviews[:max_reviews]


def analyze_reviews(reviews: list[dict[str, Any]], window_days: int, min_age_days: int) -> dict[str, Any]:
    now = datetime.now()
    window_start = now - timedelta(days=window_days)
    min_age_date = now - timedelta(days=min_age_days)

    relevant = [
        review
        for review in reviews
        if isinstance(review.get("date"), datetime)
        and window_start <= review["date"] <= min_age_date
    ]

    if not relevant:
        return {
            "no_reply_rate": 0.0,
            "no_reply_rate_neg": 0.0,
            "unanswered_neg_30d": 0,
            "sample_size": 0,
        }

    unanswered = sum(1 for review in relevant if review.get("replyDate") is None)
    no_reply_rate = (unanswered / len(relevant)) * 100

    negatives = [review for review in relevant if _safe_int(review.get("score"), 0) <= 2]
    unanswered_neg = sum(1 for review in negatives if review.get("replyDate") is None)
    no_reply_rate_neg = (unanswered_neg / len(negatives) * 100) if negatives else 0

    thirty_days_ago = now - timedelta(days=30)
    unanswered_neg_30d = sum(
        1
        for review in relevant
        if _safe_int(review.get("score"), 0) <= 2
        and review.get("replyDate") is None
        and isinstance(review.get("date"), datetime)
        and review["date"] >= thirty_days_ago
    )

    return {
        "no_reply_rate": round(no_reply_rate, 1),
        "no_reply_rate_neg": round(no_reply_rate_neg, 1),
        "unanswered_neg_30d": unanswered_neg_30d,
        "sample_size": len(relevant),
    }


def calculate_lead_score(analysis: dict[str, Any], app_details: dict[str, Any]) -> int:
    score = 0.0
    score += min(30.0, (float(analysis.get("no_reply_rate") or 0) / 100.0) * 30.0)
    score += min(30.0, (float(analysis.get("no_reply_rate_neg") or 0) / 100.0) * 30.0)
    score += min(20.0, (float(analysis.get("unanswered_neg_30d") or 0) / 10.0) * 20.0)

    reviews_count = max(1, _safe_int(app_details.get("reviews"), 0))
    score += min(10.0, (math.log10(reviews_count) / 6.0) * 10.0)

    rating = float(app_details.get("score") or 0)
    rating_score = 5.0 - rating
    score += min(10.0, (rating_score / 5.0) * 10.0)

    return int(round(score))


def run_catalog_scan(
    params: ScanParams,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    country = normalize_country(params.country)
    lang = ("en" if country == "us" else (params.lang or "en").strip().lower() or "en")
    category = params.category if params.category and params.category != "ALL" else None

    app_ids = fetch_top_apps(
        collection=params.collection,
        category=category,
        country=country,
        lang=lang,
        num=params.max_apps,
    )

    results: list[dict[str, Any]] = []
    total_errors = 0

    for idx, app_id in enumerate(app_ids):
        try:
            details = fetch_app_details(app_id, lang, country)
            if progress_callback:
                progress_callback(
                    {
                        "type": "progress",
                        "current": idx + 1,
                        "total": len(app_ids),
                        "appId": details["appId"],
                        "title": details["title"],
                    }
                )

            app_reviews = fetch_reviews(app_id, lang, country, params.max_reviews)
            analysis = analyze_reviews(app_reviews, params.window_days, params.min_age_days)
            lead_score = calculate_lead_score(analysis, details)

            row = {
                "developer": details["developer"],
                "title": details["title"],
                "url": details["url"],
                "no_reply_rate": analysis["no_reply_rate"],
                "no_reply_rate_neg": analysis["no_reply_rate_neg"],
                "unanswered_neg_30d": analysis["unanswered_neg_30d"],
                "lead_score": lead_score,
                "appId": details["appId"],
                "developerEmail": details["developerEmail"],
                "score": details["score"],
                "total_reviews_count": details["reviews"],
                "sample_size": analysis["sample_size"],
            }
            results.append(row)

            if progress_callback:
                progress_callback({"type": "result", "data": row})

            if idx < len(app_ids) - 1:
                time.sleep(APP_DELAY_SECONDS)
        except Exception as exc:
            total_errors += 1
            if progress_callback:
                progress_callback(
                    {
                        "type": "error",
                        "message": f"Error processing {app_id}: {exc}",
                        "appId": app_id,
                    }
                )

    return results, total_errors


def _extract_app_id_from_url(url_value: Any) -> str | None:
    if not isinstance(url_value, str) or not url_value.strip():
        return None

    parsed = urlparse(url_value.strip())
    app_id = parse_qs(parsed.query).get("id", [""])[0].strip()
    if PACKAGE_PATTERN.fullmatch(app_id):
        return app_id
    return None


def _candidate_from_app_payload(payload: dict[str, Any], *, top1: bool = False) -> dict[str, Any] | None:
    app_id = str(payload.get("appId") or "").strip()
    if not app_id:
        app_id = _extract_app_id_from_url(payload.get("url")) or ""

    if not app_id or not PACKAGE_PATTERN.fullmatch(app_id):
        return None

    # Always emit a public canonical store URL, even if upstream source gives /work/apps/details.
    url_value = f"https://play.google.com/store/apps/details?id={app_id}"

    return {
        "app_id": app_id,
        "title": str(payload.get("title") or app_id),
        "url": str(url_value),
        "score": payload.get("score"),
        "reviews_count": payload.get("reviews") or payload.get("ratings") or payload.get("installs"),
        "is_top1": top1,
    }


def _resolve_package_candidate(package_name: str, country: str, lang: str) -> dict[str, Any]:
    details = gp_app(package_name, country=country, lang=lang)
    candidate = _candidate_from_app_payload(details, top1=True)
    if candidate is None:
        raise ResolveInputError(f"Could not resolve app details for package: {package_name}")
    return candidate


def _mark_top1(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not candidates:
        return candidates
    for item in candidates:
        item["is_top1"] = False
    candidates[0]["is_top1"] = True
    return candidates


def _search_candidates_via_bridge(query_value: str, country: str, lang: str, limit: int) -> list[dict[str, Any]]:
    payload = {
        "mode": "search",
        "term": query_value,
        "country": country,
        "lang": lang,
        "num": max(1, min(int(limit), 20)),
    }

    try:
        result = _run_bridge(payload)
    except Exception:
        return []

    items = result.get("items")
    if not isinstance(items, list):
        return []

    candidates: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        candidate = _candidate_from_app_payload(item, top1=False)
        if candidate:
            candidates.append(candidate)

    return _mark_top1(candidates)


def _search_candidates_via_python(query_value: str, country: str, lang: str, limit: int) -> list[dict[str, Any]]:
    search_results = gp_search(query_value, lang=lang, country=country, n_hits=max(1, min(limit, 20)))
    candidates: list[dict[str, Any]] = []
    for item in search_results:
        candidate = _candidate_from_app_payload(item, top1=False)
        if candidate:
            candidates.append(candidate)

    return _mark_top1(candidates)


def resolve_google_play_input(input_value: str, country: str = "us", lang: str = "en", limit: int = 5) -> dict[str, Any]:
    raw_value = (input_value or "").strip()
    if not raw_value:
        raise ResolveInputError("Input is required.")

    norm_country = normalize_country(country)
    norm_lang = (lang or "en").strip().lower() or "en"
    if norm_country == "us":
        norm_lang = "en"

    if PACKAGE_PATTERN.fullmatch(raw_value):
        candidate = _resolve_package_candidate(raw_value, norm_country, norm_lang)
        return {
            "input_type": "package",
            "recommended_app_id": candidate["app_id"],
            "candidates": [candidate],
        }

    parsed = urlparse(raw_value)
    if parsed.netloc and parsed.netloc not in {"play.google.com", "www.play.google.com"}:
        raise ResolveInputError("Expected Google Play URL or package name.")

    input_type = "query"
    query_value = raw_value

    if parsed.netloc:
        if parsed.path.rstrip("/") == "/store/apps/details":
            app_id = parse_qs(parsed.query).get("id", [""])[0].strip()
            if not PACKAGE_PATTERN.fullmatch(app_id):
                raise ResolveInputError("Could not extract valid app id from details URL.")
            candidate = _resolve_package_candidate(app_id, norm_country, norm_lang)
            return {
                "input_type": "details_url",
                "recommended_app_id": candidate["app_id"],
                "candidates": [candidate],
            }

        if parsed.path.rstrip("/") == "/store/search":
            input_type = "search_url"
            query_value = parse_qs(parsed.query).get("q", [""])[0].strip()
            if not query_value:
                raise ResolveInputError("Search URL must include a non-empty q parameter.")

    candidates = _search_candidates_via_bridge(query_value, norm_country, norm_lang, limit)
    if not candidates:
        candidates = _search_candidates_via_python(query_value, norm_country, norm_lang, limit)

    if not candidates:
        raise ResolveInputError(f"No apps found for query: {query_value}")

    return {
        "input_type": input_type,
        "recommended_app_id": candidates[0]["app_id"],
        "candidates": candidates,
    }
