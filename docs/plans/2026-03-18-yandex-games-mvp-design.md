# Yandex Games MVP Design

**Date:** 2026-03-18

**Status:** Approved

## Goal

Add Yandex Games review scraping as a new `store=yandex_games` source in the existing pipeline for MVP, accepting only direct game URLs like `https://yandex.ru/games/app/<id>`.

## Scope

In scope:

- direct Yandex Games game URL input only
- new source integrated into the existing report pipeline
- primary transport based on XHR/API scraping
- architecture prepared for a future Playwright fallback
- review normalization into the existing internal schema

Out of scope for MVP:

- search or resolve flow by game name
- residential proxy support
- region-specific behavior guarantees
- full Playwright fallback implementation

## Recommended Approach

Use a hybrid source adapter with a single public fetch API and pluggable internal strategies:

1. `XHRStrategy` is the default and only implemented strategy for MVP.
2. `PlaywrightStrategy` is defined as an extension point and fallback target, but remains unimplemented in MVP.
3. The public adapter decides whether to stay in XHR mode, retry, or surface a structured fallback condition.

This keeps the current backend API clean while acknowledging that Yandex may require a browser-based fallback later.

## Architecture

### Source Integration

Add a new source module at `sources/yandex_games.py` that exposes an async fetch function similar in shape to `sources/app_store.py`.

The module will:

- validate and normalize the incoming Yandex Games URL
- extract `app_id` from `/games/app/<id>`
- fetch the game page using `curl_cffi` with browser impersonation
- parse HTML or inline state to discover the reviews XHR configuration
- paginate reviews via `nextPageToken`
- normalize reviews into the existing internal format
- return a payload compatible with the existing report flow

### Transport Strategy Boundary

The source should separate transport behavior from orchestration:

- `XHRStrategy`: page fetch + review API pagination using `curl_cffi`
- `PlaywrightStrategy`: future fallback boundary for browser-driven scraping

The adapter owns retry policy, fallback conditions, and payload shaping. `server.py` should not know whether XHR or browser automation was used.

## Data Flow

1. User submits a report request with `store=yandex_games` and a direct Yandex Games URL.
2. The server routes the request into the Yandex Games source path.
3. The source validates the URL and extracts `app_id`.
4. `XHRStrategy` requests the game page with browser impersonation.
5. The strategy extracts metadata and review API parameters from the page.
6. The strategy requests review pages through the XHR endpoint, following `nextPageToken`.
7. Reviews are normalized into the existing internal review schema.
8. The standard pipeline continues unchanged.

## Fallback And Failure Policy

Fallback must be explicit and narrow. The source should only escalate to a fallback condition when:

- the game page loads but no usable review API configuration can be extracted
- the API consistently returns anti-bot or challenge responses
- the API response shape is incompatible after bounded retries

The source should not trigger fallback for every transient network error. Standard retry behavior should handle:

- timeouts
- intermittent 5xx responses
- temporary empty responses

For MVP, fallback should remain an unimplemented path with clear logging and a typed error or condition that makes later Playwright integration straightforward.

## API Contract

The new source should return a payload shaped like the existing App Store source:

```python
{
    "app_id": "423744",
    "app_name": "Example Game",
    "country": "ru",
    "reviews": [...],
    "app_metadata": {...},
    "fetched_at": "2026-03-18T12:00:00+00:00",
    "cache_hit": False,
}
```

Review items should match the existing normalized structure:

```python
{
    "review_id": "string",
    "date": "ISO-8601 UTC string",
    "rating": 5,
    "text": "review text",
    "version": None,
    "thumbs_up": 0,
    "original_lang": "ru",
    "lang": "ru",
    "has_reply": False,
    "reply_text": None,
    "reply_date": None,
}
```

## Server Changes

Extend the existing `store` handling in `server.py` from:

- `google_play`
- `app_store`

to:

- `google_play`
- `app_store`
- `yandex_games`

For MVP there is no dedicated resolve endpoint. The direct report flow should accept a Yandex Games URL and route it directly into the Yandex Games source.

## Dependencies

Add `curl_cffi` to `requirements.txt`.

The standard `httpx` transport is not appropriate for this source because the stated expectation is that Yandex WAF blocks it reliably.

## Testing Strategy

Add source-level unit tests in `tests/test_yandex_games_source.py` covering:

- valid direct URL parsing and `app_id` extraction
- invalid Yandex Games URL rejection
- review payload normalization
- cursor pagination using `nextPageToken`
- bounded retry behavior
- fallback condition emission when XHR extraction fails

These tests should monkeypatch the transport layer and not depend on live requests.

Integration behavior against the real Yandex site remains a manual verification concern because WAF and page schema are external and unstable.

## Risks

- The Yandex Games reviews API is unofficial and may change without notice.
- The reviews endpoint may require state hidden in HTML or client boot payloads.
- `curl_cffi` impersonation may still be insufficient without residential proxies.
- The “more details” user interaction may correspond to client-side lazy loading that requires more reverse engineering than expected.

## Decision

Proceed with a hybrid design where XHR scraping is the only implemented MVP path, and Playwright fallback is preserved as a future extension boundary rather than built immediately.
