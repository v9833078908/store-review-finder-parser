# App Store Direct Input Design

**Date:** 2026-03-12

## Goal

Add App Store review analytics to `/search-app` for direct report generation by numeric `app_id`, without introducing App Store catalog scan.

## Scope

- Add `Store` switch in the existing `Generate Report` block on `/search-app`
- Support `app_store` direct input by numeric `app_id`
- Resolve a numeric App Store ID into a single app candidate
- Fetch App Store reviews via Apple RSS/JSON customer reviews API
- Reuse the existing unified report pipeline, dashboard, SSE progress flow, and artifact storage

Out of scope:

- App Store catalog scan / lead finder parity
- App Store search by keywords
- App Store URL freeform parsing in MVP
- Multi-candidate App Store resolve flow

## Product Decisions

- UX stays on the current `/search-app` page
- The existing `Generate Report` card gets a store selector: `Google Play` or `App Store`
- Google Play behavior remains unchanged
- App Store input accepts only a numeric `app_id`
- App Store resolve returns a single recommended candidate, using a response shape compatible with the Google Play resolver

## API Design

### Frontend -> Backend

Add `store=google_play|app_store` to report requests.

Google Play:
- continues using `/api/resolve/google-play`
- continues using current `/api/report` and `/api/report/sync`

App Store:
- new `/api/resolve/app-store`
- same `/api/report` and `/api/report/sync`, with `store=app_store`

### Resolve Contract

App Store resolve should match the current `ResolveResponse` shape:

- `input_type`
- `recommended_app_id`
- `candidates`

For App Store MVP, `candidates` contains exactly one item:

- `app_id`
- `title`
- `url`
- `score`
- `reviews_count`
- `is_top1`

## Backend Architecture

### Source Adapter

Add a new adapter at `sources/app_store.py`.

Responsibilities:

- validate numeric `app_id`
- fetch app metadata
- fetch review pages from Apple RSS/JSON API using `httpx`
- paginate `page=1..10`
- normalize Apple review payloads into the current internal review shape

Target API pattern:

`https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={app_id}/sortby=mostrecent/json`

### Unified Fetch Selection

Keep the current report pipeline shared.

At the report entry point, select one source:

- `google_play` -> current Google Play fetch path
- `app_store` -> new App Store fetch path

The rest of the pipeline should stay source-agnostic.

## Data Normalization

App Store reviews should normalize to the same internal fields used by Google Play:

- `review_id`
- `date`
- `rating`
- `text`
- `version`
- `thumbs_up`
- `original_lang`
- `lang`
- `has_reply`
- `reply_text`
- `reply_date`

Expected App Store defaults for missing data:

- `thumbs_up = 0`
- `has_reply = False`
- `reply_text = None`
- `reply_date = None`

App metadata should also match the current app metadata shape as closely as possible:

- `app_name`
- `version`
- `recent_changes`
- `last_updated_on`
- `score`
- `ratings`
- `histogram`

If Apple does not provide some fields, use safe fallbacks instead of failing the report.

## Identity and Run History

Current storage and dashboard hydration are keyed by `package_name`, which is Google Play specific.

For MVP:

- persist `store` into run artifacts
- store App Store numeric ID in `package_name` for backward compatibility
- ensure frontend runtime mapping reads `store` when present

This keeps the current run history contract stable while allowing App Store runs to work without a larger storage redesign.

## Validation and Limits

- App Store input must be numeric `app_id`
- App Store max review limit should be capped at `500`
- Fewer than `500` reviews is acceptable; pipeline continues with available data
- Metadata gaps should degrade gracefully, not block report generation

## Error Handling

- invalid App Store ID -> `400`
- Apple response missing app/review payload -> meaningful `404` or `422`
- no reviews for selected region/window -> preserve current report route behavior
- transient Apple failures -> retry inside the adapter where practical

## Testing Strategy

- unit tests for App Store ID validation and response normalization
- route tests for `/api/resolve/app-store`
- route tests for `/api/report` and `/api/report/sync` with `store=app_store`
- regression tests proving Google Play behavior is unchanged

## Recommended Implementation Approach

Use a shared report flow with an explicit `store` parameter and a new App Store adapter.

Why:

- minimal UI duplication
- minimal pipeline duplication
- lowest regression risk for Google Play
- clean path to future extension if App Store scan is added later
