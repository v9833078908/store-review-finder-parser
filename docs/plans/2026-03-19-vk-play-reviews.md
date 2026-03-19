# VK Play Reviews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `vk_play` as a new direct-URL review source with date-window filtering and language selection in the existing report pipeline and UI.

**Architecture:** Implement a new `sources/vk_play.py` module using anonymous VK Play JSON APIs. Route `store=vk_play` through `server.py`, reuse existing report generation, keep period filtering active, and add an MVP direct-URL flow to the frontend without a resolve endpoint.

**Tech Stack:** Python, FastAPI, httpx, pytest, Next.js, TypeScript

---

### Task 1: Add VK Play source tests first

**Files:**
- Create: `tests/test_vk_play_source.py`
- Reference: `sources/yandex_games.py`
- Reference: `tests/test_yandex_games_source.py`

**Step 1: Write the failing tests**

Add tests for:

- direct URL validation and slug extraction
- language mapping `ru -> ru_RU`, `en -> en_US`, fallback to `ru_RU`
- review normalization from `microreviews_v2`
- pagination through `next`
- failure on invalid catalog payload
- failure on invalid reviews payload

**Step 2: Run test to verify it fails**

Run: `./venv/bin/python -m pytest tests/test_vk_play_source.py -q`

Expected: FAIL because `sources.vk_play` does not exist yet.

**Step 3: Write minimal implementation**

Create `sources/vk_play.py` with stubbed functions and typed errors needed by the tests.

**Step 4: Run test to verify progress**

Run: `./venv/bin/python -m pytest tests/test_vk_play_source.py -q`

Expected: fewer failures, now pointing to missing real logic.

**Step 5: Commit**

```bash
git add tests/test_vk_play_source.py sources/vk_play.py
git commit -m "test: add vk play source coverage"
```

### Task 2: Implement VK Play metadata and reviews fetch

**Files:**
- Modify: `sources/vk_play.py`
- Test: `tests/test_vk_play_source.py`

**Step 1: Write the failing test**

Add tests for:

- catalog metadata fetch parses numeric `id`, `name`, `reviewsCount`, `avgRating`
- `fetch_vk_play_reviews(...)` returns normalized payload with `reviews`

**Step 2: Run the focused tests**

Run: `./venv/bin/python -m pytest tests/test_vk_play_source.py -q`

Expected: FAIL on unimplemented transport/data parsing.

**Step 3: Write minimal implementation**

Implement:

- `extract_vk_play_slug(url)`
- `_map_vk_play_lang(lang)`
- `_fetch_vk_play_catalog(...)`
- `_fetch_vk_play_reviews_page(...)`
- `normalize_vk_play_review(raw)`
- `fetch_vk_play_reviews(...)`

Use `httpx.AsyncClient` and follow `next` URLs until `max_reviews`.

**Step 4: Run source tests**

Run: `./venv/bin/python -m pytest tests/test_vk_play_source.py -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add sources/vk_play.py tests/test_vk_play_source.py
git commit -m "feat: add vk play review source"
```

### Task 3: Wire VK Play into backend routing

**Files:**
- Modify: `server.py`
- Modify: `tests/test_server_report_routes.py`

**Step 1: Write the failing backend tests**

Add tests that:

- accept `store=vk_play`
- resolve package identity from direct URL
- keep period filtering active
- avoid region fanout logic

**Step 2: Run the focused backend tests**

Run: `./venv/bin/python -m pytest tests/test_server_report_routes.py -q`

Expected: FAIL because `vk_play` is not yet wired.

**Step 3: Write minimal backend implementation**

Update `server.py` to:

- include `vk_play` in store validation
- route fetches to `fetch_vk_play_reviews(...)`
- keep `period/from/to/langs` support
- skip region fanout for `vk_play`

**Step 4: Run backend tests**

Run: `./venv/bin/python -m pytest tests/test_server_report_routes.py tests/test_vk_play_source.py -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add server.py tests/test_server_report_routes.py tests/test_vk_play_source.py sources/vk_play.py
git commit -m "feat: add vk play report routing"
```

### Task 4: Add VK Play to frontend direct-URL flow

**Files:**
- Modify: `frontend/src/app/search-app/page.tsx`
- Modify: `frontend/src/hooks/use-report.ts`
- Modify: `frontend/src/lib/api-types.ts`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/app/report/page.tsx`
- Modify: `frontend/src/lib/runtime-mapper.ts`

**Step 1: Write the frontend changes**

Add `vk_play` store support with:

- direct URL validation
- no resolve endpoint call
- visible period field
- visible language field with default `ru`
- hidden region field

**Step 2: Run the frontend build**

Run: `cd frontend && npm run build`

Expected: initial FAIL until all store unions and props are updated.

**Step 3: Write minimal implementation**

Update the store selector, query construction, UI toggles, and type unions to support `vk_play`.

**Step 4: Re-run the frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/app/search-app/page.tsx frontend/src/hooks/use-report.ts frontend/src/lib/api-types.ts frontend/src/lib/types.ts frontend/src/app/report/page.tsx frontend/src/lib/runtime-mapper.ts
git commit -m "feat: add vk play search flow"
```

### Task 5: Run full verification and live check

**Files:**
- Modify: none unless failures require fixes

**Step 1: Run backend/source verification**

Run: `./venv/bin/python -m pytest tests/test_vk_play_source.py tests/test_server_report_routes.py tests/test_yandex_games_source.py tests/test_app_store_source.py -q`

Expected: PASS.

**Step 2: Run frontend verification**

Run: `cd frontend && npm run build`

Expected: PASS.

**Step 3: Run a live source smoke check**

Run:

```bash
./venv/bin/python - <<'PY'
import asyncio
from sources.vk_play import fetch_vk_play_reviews

async def main():
    data = await fetch_vk_play_reviews(
        "https://vkplay.ru/play/game/pirate-ships-46035",
        max_reviews=10,
        lang="ru",
    )
    print(data["app_id"])
    print(data["app_name"])
    print(len(data["reviews"]))

asyncio.run(main())
PY
```

Expected: numeric game id, game name, and a non-zero review count.

**Step 4: Commit final verification-only fixes if needed**

```bash
git add <changed files>
git commit -m "fix: finalize vk play review integration"
```

