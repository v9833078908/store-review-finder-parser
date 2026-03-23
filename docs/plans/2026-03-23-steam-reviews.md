# Steam Reviews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Steam Store review scraping by direct game URL and wire it into single-source and multi-source report generation.

**Architecture:** Implement a dedicated `sources/steam.py` adapter that extracts `app_id` from direct Steam Store URLs, fetches paginated review data from the Steam reviews endpoint, normalizes reviews into the existing internal schema, and plugs into `server.py` alongside the existing store adapters. Reuse current backend window filtering and frontend MVP direct-URL flows instead of adding title resolution.

**Tech Stack:** Python async source adapter, FastAPI backend routes, Next.js frontend, pytest.

---

### Task 1: Add Steam source parsing and normalization

**Files:**
- Create: `sources/steam.py`
- Test: `tests/test_steam_source.py`

**Step 1: Write failing tests for URL parsing and review normalization**
- Add tests for valid Steam URL extraction
- Add tests for invalid URL rejection
- Add tests for normalized review payload shape

**Step 2: Run tests to verify they fail**
Run: `./venv/bin/python -m pytest tests/test_steam_source.py -q`
Expected: FAIL because `sources/steam.py` does not exist yet

**Step 3: Write minimal implementation**
- Implement `extract_steam_app_id(url)`
- Implement `normalize_steam_review(raw)`
- Keep implementation minimal and aligned with existing source modules

**Step 4: Run tests to verify they pass**
Run: `./venv/bin/python -m pytest tests/test_steam_source.py -q`
Expected: PASS for parsing/normalization tests

**Step 5: Commit**
```bash
git add sources/steam.py tests/test_steam_source.py
git commit -m "feat: add steam source primitives"
```

### Task 2: Add Steam reviews fetching and pagination

**Files:**
- Modify: `sources/steam.py`
- Modify: `tests/test_steam_source.py`

**Step 1: Write failing tests for pagination and invalid payload handling**
- Add test for following Steam cursor pagination
- Add test for malformed endpoint payload rejection

**Step 2: Run tests to verify they fail**
Run: `./venv/bin/python -m pytest tests/test_steam_source.py -q`
Expected: FAIL in fetch/pagination tests

**Step 3: Write minimal fetch implementation**
- Add `fetch_steam_reviews(...)`
- Add internal helper(s) for calling Steam reviews endpoint
- Normalize endpoint reviews and collect until `max_reviews`

**Step 4: Run tests to verify they pass**
Run: `./venv/bin/python -m pytest tests/test_steam_source.py -q`
Expected: PASS

**Step 5: Commit**
```bash
git add sources/steam.py tests/test_steam_source.py
git commit -m "feat: add steam reviews fetcher"
```

### Task 3: Wire Steam into backend single-source and multi-source flows

**Files:**
- Modify: `server.py`
- Modify: `tests/test_server_report_routes.py`
- Modify: `tests/test_multi_source_report.py`

**Step 1: Write failing backend tests**
- Add route contract test for `store=steam`
- Add `_generate_dashboard(...)` branch test for Steam fetch path
- Add multi-source aggregation test covering `steam`

**Step 2: Run tests to verify they fail**
Run: `./venv/bin/python -m pytest tests/test_server_report_routes.py tests/test_multi_source_report.py -q`
Expected: FAIL because backend does not support `steam` yet

**Step 3: Write minimal backend implementation**
- Import `fetch_steam_reviews` and URL extraction helper
- Extend `store` validation regexes to include `steam`
- Add Steam branch in `_generate_dashboard(...)`
- Add Steam branch in `_fetch_source_payload(...)`
- Reuse existing language and window filtering logic

**Step 4: Run tests to verify they pass**
Run: `./venv/bin/python -m pytest tests/test_server_report_routes.py tests/test_multi_source_report.py tests/test_steam_source.py -q`
Expected: PASS

**Step 5: Commit**
```bash
git add server.py tests/test_server_report_routes.py tests/test_multi_source_report.py
git commit -m "feat: wire steam report flow"
```

### Task 4: Add Steam to frontend single-source flow

**Files:**
- Modify: `frontend/src/app/search-app/page.tsx`
- Modify: `frontend/src/hooks/use-report.ts`
- Modify: `frontend/src/app/report/page.tsx`
- Modify: `frontend/src/lib/api-types.ts`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/runtime-mapper.ts`

**Step 1: Write failing frontend-aware checks**
- Add minimal type support for `steam`
- Ensure build will fail until `steam` is wired through unions/usages

**Step 2: Run build to verify it fails or is incomplete**
Run: `cd frontend && npm run build`
Expected: FAIL or missing support until UI changes are added

**Step 3: Write minimal frontend implementation**
- Add `steam` to store types and selectors
- Add direct URL validation flow for Steam
- Show language + period controls, hide region
- Support Steam in report query building and report page parsing

**Step 4: Run build to verify it passes**
Run: `cd frontend && npm run build`
Expected: PASS

**Step 5: Commit**
```bash
git add frontend/src/app/search-app/page.tsx frontend/src/hooks/use-report.ts frontend/src/app/report/page.tsx frontend/src/lib/api-types.ts frontend/src/lib/types.ts frontend/src/lib/runtime-mapper.ts
git commit -m "feat: add steam frontend flow"
```

### Task 5: Add Steam to combined multi-source selector and final verification

**Files:**
- Modify: `frontend/src/app/search-app/page.tsx`
- Verify: `server.py`
- Verify: `tests/test_steam_source.py`
- Verify: `tests/test_server_report_routes.py`
- Verify: `tests/test_multi_source_report.py`

**Step 1: Add combined-source Steam config support**
- Add `steam` to combined selector options
- Add direct URL + lang + period inputs
- Build proper `sources` payload for Steam

**Step 2: Run full targeted verification**
Run: `./venv/bin/python -m pytest tests/test_steam_source.py tests/test_server_report_routes.py tests/test_multi_source_report.py tests/test_vk_play_source.py tests/test_yandex_games_source.py tests/test_app_store_source.py -q`
Expected: PASS

**Step 3: Run frontend build**
Run: `cd frontend && npm run build`
Expected: PASS

**Step 4: Perform manual smoke check**
- Single-source Steam report via `/search-app`
- Combined report including Steam + one existing source

**Step 5: Commit**
```bash
git add frontend/src/app/search-app/page.tsx
git commit -m "feat: add steam multi source support"
```
