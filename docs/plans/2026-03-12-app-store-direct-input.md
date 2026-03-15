# App Store Direct Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add App Store direct-input report generation to `/search-app` by numeric `app_id`, while preserving the existing Google Play flow and shared dashboard pipeline.

**Architecture:** Extend the current direct-report flow with an explicit `store` parameter, add a dedicated `sources/app_store.py` adapter for resolve and review fetching, and reuse the existing report endpoints, SSE flow, pipeline, and dashboard artifact model. Keep App Store catalog scanning out of scope and treat the App Store numeric ID as the artifact identifier for MVP compatibility.

**Tech Stack:** FastAPI, Next.js App Router, TypeScript, Python 3, `httpx`, pytest, existing unified report pipeline

---

### Task 1: Lock down backend route contracts before implementation

**Files:**
- Modify: `tests/test_server_report_routes.py`
- Modify: `tests/test_server_scan_routes.py`

**Step 1: Write the failing test for report routes carrying `store`**

Add a test in `tests/test_server_report_routes.py` that monkeypatches `server._generate_dashboard`, calls `/api/report/sync` with:

```python
params={
    "store": "app_store",
    "url": "https://apps.apple.com/app/id123456789",
    "country": "us",
    "app_id": "123456789",
}
```

and asserts:

```python
assert kwargs["store"] == "app_store"
assert kwargs["app_id"] == "123456789"
```

**Step 2: Run test to verify it fails**

Run:

```bash
pytest tests/test_server_report_routes.py::test_report_sync_contract_accepts_app_store -v
```

Expected: FAIL because the route does not yet accept or forward `store`.

**Step 3: Write the failing test for App Store resolve route**

Add a test in `tests/test_server_scan_routes.py` for `/api/resolve/app-store` that monkeypatches a new `server.resolve_app_store_input` and asserts the route returns:

```python
{
    "input_type": "app_store_id",
    "recommended_app_id": "123456789",
    "candidates": [...],
}
```

**Step 4: Run test to verify it fails**

Run:

```bash
pytest tests/test_server_scan_routes.py::test_resolve_app_store_contract -v
```

Expected: FAIL because the route does not exist yet.

**Step 5: Commit**

```bash
git add tests/test_server_report_routes.py tests/test_server_scan_routes.py
git commit -m "test: define app store route contracts"
```

### Task 2: Add App Store source adapter with normalization tests

**Files:**
- Create: `sources/app_store.py`
- Create: `tests/test_app_store_source.py`

**Step 1: Write the failing source tests**

Add tests in `tests/test_app_store_source.py` for:

- numeric `app_id` validation
- review normalization from Apple payload into:

```python
{
    "review_id": "...",
    "date": "...",
    "rating": 4,
    "text": "Sample review",
    "version": "1.2.3",
    "thumbs_up": 0,
    "original_lang": "en",
    "lang": "en",
    "has_reply": False,
    "reply_text": None,
    "reply_date": None,
}
```

- page limit clamped to 10 pages / 500 reviews

**Step 2: Run test to verify it fails**

Run:

```bash
pytest tests/test_app_store_source.py -v
```

Expected: FAIL because `sources/app_store.py` does not exist.

**Step 3: Write minimal implementation**

Implement in `sources/app_store.py`:

- App Store ID validation helper
- Apple RSS URL builder
- metadata lookup helper
- review normalization helper
- async fetch function using `httpx.AsyncClient`
- public functions:

```python
async def resolve_app_store_input(app_id: str, country: str = "us") -> dict[str, Any]:
    ...

async def fetch_app_store_reviews(
    app_id: str,
    max_reviews: int = 500,
    country: str = "us",
    force_refresh: bool = False,
    cache_ttl: timedelta | None = None,
) -> dict[str, Any]:
    ...
```

Use graceful fallbacks for fields Apple does not expose.

**Step 4: Run test to verify it passes**

Run:

```bash
pytest tests/test_app_store_source.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add sources/app_store.py tests/test_app_store_source.py
git commit -m "feat: add app store source adapter"
```

### Task 3: Wire App Store into FastAPI resolve and report routes

**Files:**
- Modify: `server.py`
- Modify: `tests/test_server_report_routes.py`
- Modify: `tests/test_server_scan_routes.py`

**Step 1: Run the route tests again before implementation**

Run:

```bash
pytest tests/test_server_report_routes.py::test_report_sync_contract_accepts_app_store tests/test_server_scan_routes.py::test_resolve_app_store_contract -v
```

Expected: FAIL

**Step 2: Write minimal implementation**

In `server.py`:

- import App Store adapter functions
- add `store: str = Query("google_play", pattern="^(google_play|app_store)$")` to:
  - `/api/report`
  - `/api/report/sync`
- forward `store` into `_generate_dashboard`
- add `/api/resolve/app-store`
- branch inside `_generate_dashboard` fetch selection:
  - Google Play -> current path
  - App Store -> `fetch_app_store_reviews(...)`

Keep App Store max reviews capped at 500.

**Step 3: Run focused route tests**

Run:

```bash
pytest tests/test_server_report_routes.py tests/test_server_scan_routes.py -v
```

Expected: PASS for the new App Store route cases and no regressions in existing Google Play route tests.

**Step 4: Run the full backend route suite**

Run:

```bash
pytest tests/test_server_report_routes.py tests/test_server_scan_routes.py tests/test_server_runs_routes.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add server.py tests/test_server_report_routes.py tests/test_server_scan_routes.py
git commit -m "feat: wire app store through report routes"
```

### Task 4: Make storage and run artifacts App Store-safe

**Files:**
- Modify: `storage.py`
- Modify: `frontend/src/lib/runtime-mapper.ts`
- Modify: `frontend/src/lib/api-types.ts`
- Test: `tests/test_server_runs_routes.py`

**Step 1: Write the failing artifact compatibility test**

Add a test covering an App Store run artifact that stores:

```python
{
    "store": "app_store",
    "package_name": "123456789",
    "app_name": "Sample iOS Game",
}
```

and verify listing/loading still works.

**Step 2: Run test to verify it fails**

Run:

```bash
pytest tests/test_server_runs_routes.py -v
```

Expected: FAIL or missing assertions for App Store metadata propagation.

**Step 3: Write minimal implementation**

Update storage/runtime mapping so that:

- `store` is persisted in artifacts
- App Store runs use numeric `app_id` in `package_name` for MVP compatibility
- frontend runtime mapping reads `store` if present and falls back to `google_play`

Do not redesign the artifact schema beyond what is needed for App Store compatibility.

**Step 4: Run test to verify it passes**

Run:

```bash
pytest tests/test_server_runs_routes.py -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add storage.py frontend/src/lib/runtime-mapper.ts frontend/src/lib/api-types.ts tests/test_server_runs_routes.py
git commit -m "feat: support app store run artifacts"
```

### Task 5: Add frontend store switch and App Store resolve flow

**Files:**
- Modify: `frontend/src/app/search-app/page.tsx`
- Modify: `frontend/src/lib/lead-search/types.ts`
- Create: `frontend/src/app/api/resolve/app-store/route.ts`

**Step 1: Write the failing frontend type/update expectations**

Add or update TypeScript types so `ResolveResponse` can represent:

```ts
input_type: "package" | "details_url" | "search_url" | "query" | "app_store_id"
```

and introduce a frontend store type:

```ts
type ReportStore = "google_play" | "app_store"
```

Then run the frontend build before implementation.

**Step 2: Run build to verify it fails once references are incomplete**

Run:

```bash
cd frontend && npm run build
```

Expected: FAIL until the page logic and new proxy route are updated.

**Step 3: Write minimal implementation**

In `frontend/src/app/search-app/page.tsx`:

- add a `Store` selector for `Google Play` and `App Store`
- keep scan UI Google Play only
- change direct input validation:
  - Google Play -> existing behavior
  - App Store -> numeric `app_id` only
- call:
  - `/api/resolve/google-play` for Google Play
  - `/api/resolve/app-store` for App Store
- build `/report` query with `store=...`
- adjust copy and placeholders by store

In `frontend/src/app/api/resolve/app-store/route.ts`:

- proxy to backend `/api/resolve/app-store`

**Step 4: Run build to verify it passes**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/app/search-app/page.tsx frontend/src/lib/lead-search/types.ts frontend/src/app/api/resolve/app-store/route.ts
git commit -m "feat: add app store direct-input flow to search app"
```

### Task 6: Add end-to-end regression coverage for mixed-store report generation

**Files:**
- Modify: `tests/test_server_report_routes.py`
- Modify: `tests/test_server_scan_routes.py`
- Modify: `README.md`

**Step 1: Add missing regression cases**

Add tests for:

- Google Play `/api/report` still defaults to `store=google_play`
- App Store `/api/report/sync` rejects non-numeric `app_id`
- App Store route clamps excessive `max_reviews`

**Step 2: Run focused tests to verify failures**

Run:

```bash
pytest tests/test_server_report_routes.py tests/test_server_scan_routes.py -v
```

Expected: FAIL until missing validation/behavior is implemented.

**Step 3: Write minimal implementation**

Patch only the validation or docs gaps needed to satisfy the new tests.

In `README.md`, update local and Docker usage notes to mention:

- `store=app_store`
- numeric `app_id` input
- App Store direct report only, no scan

**Step 4: Run full verification**

Run:

```bash
pytest tests/test_server_report_routes.py tests/test_server_scan_routes.py tests/test_server_runs_routes.py tests/test_app_store_source.py -v
cd frontend && npm run build
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_server_report_routes.py tests/test_server_scan_routes.py README.md
git commit -m "test: cover app store direct-input flow"
```
