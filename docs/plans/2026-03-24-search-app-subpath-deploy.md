# Search App Subpath Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the review parser app to `https://dev.tools.herocraft.com/search-app` with frontend and backend behavior fully working under the `/search-app` prefix.

**Architecture:** The public entrypoint is the Next.js frontend, built with a `basePath` of `/search-app` and exposed through Coolify/Traefik with a path-prefix router. The FastAPI backend stays private on the Coolify Docker network and is called from Next route handlers via internal service URL.

**Tech Stack:** Next.js App Router, FastAPI, Docker Compose, Coolify, Traefik, pytest

---

### Task 1: Audit Subpath-Sensitive Frontend Paths

**Files:**
- Modify: `frontend/next.config.ts`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/layout/header.tsx`
- Modify: `frontend/src/components/layout/app-sidebar.tsx`
- Modify: `frontend/src/app/command-center/page.tsx`

**Step 1: Write the failing verification target**

Check for root-based routes that could escape `/search-app`.

**Step 2: Run audit**

Run: `rg -n 'href=\"/|redirect\\(\"/|pathname\\.startsWith\\(\"/' frontend/src frontend/next.config.ts`
Expected: find all root-based route assumptions.

**Step 3: Write minimal implementation**

Add `basePath` support and normalize route references so the app remains valid under the subpath.

**Step 4: Run verification**

Run: `npm run build`
Working directory: `frontend`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/next.config.ts frontend/src/app/page.tsx frontend/src/components/layout/header.tsx frontend/src/components/layout/app-sidebar.tsx frontend/src/app/command-center/page.tsx
git commit -m "feat: add search-app base path support"
```

### Task 2: Verify Frontend API and Runtime URL Configuration

**Files:**
- Modify: `frontend/src/lib/server-backend-url.ts`
- Modify: `frontend/src/app/api/scan/route.ts`
- Modify: `frontend/src/app/api/report/route.ts`
- Modify: `frontend/src/app/api/report/sync/route.ts`
- Modify: `frontend/src/app/api/runs/route.ts`
- Modify: `frontend/src/app/api/runs/[run_id]/route.ts`
- Modify: `frontend/src/app/api/resolve/google-play/route.ts`
- Modify: `frontend/src/app/api/resolve/app-store/route.ts`

**Step 1: Write the failing verification target**

Identify any code that constructs public root-based API paths or assumes the app is served from `/`.

**Step 2: Run audit**

Run: `rg -n '"/api/|fetch\\(`/api|new URL\\(' frontend/src`
Expected: find route handler and fetch assumptions.

**Step 3: Write minimal implementation**

Keep public browser calls relative and keep server-side backend calls on internal service URL.

**Step 4: Run verification**

Run: `npm run build`
Working directory: `frontend`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/server-backend-url.ts frontend/src/app/api
git commit -m "fix: keep api routing compatible with subpath deploy"
```

### Task 3: Prepare Production Docker Configuration

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Write the failing verification target**

Define the environment values required for Coolify deployment under `/search-app`.

**Step 2: Run audit**

Run: `sed -n '1,220p' docker-compose.yml && sed -n '1,120p' .env.example`
Expected: confirm missing deployment-specific env vars.

**Step 3: Write minimal implementation**

Add configurable frontend subpath env, production API URLs, and production-safe CORS defaults.

**Step 4: Run verification**

Run: `docker compose config`
Expected: PASS

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example README.md
git commit -m "chore: prepare docker config for coolify subpath deploy"
```

### Task 4: Verify Backend Production Compatibility

**Files:**
- Modify: `server.py`
- Test: `tests/test_server_report_routes.py`

**Step 1: Write the failing test**

Add or adjust a test for production CORS/origin behavior if current logic is too local-only.

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_server_report_routes.py -q`
Expected: FAIL if CORS or origin handling is incomplete.

**Step 3: Write minimal implementation**

Allow the production origin needed by the public frontend deployment.

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_server_report_routes.py -q`
Expected: PASS

**Step 5: Commit**

```bash
git add server.py tests/test_server_report_routes.py
git commit -m "fix: allow production frontend origin"
```

### Task 5: Deploy to Coolify on Vibetools

**Files:**
- Modify: Coolify application configuration on `vibetools`

**Step 1: Gather deployment inputs**

Collect repository URL, branch, required env vars, and target domain rule for `/search-app`.

**Step 2: Create or update the Coolify app**

Use Coolify to create a Docker Compose based deployment or equivalent multi-service app with:
- public frontend service
- private backend service
- `PathPrefix(`/search-app`)` routing on `dev.tools.herocraft.com`

**Step 3: Trigger deployment**

Run the Coolify deployment and monitor logs until services become healthy.

**Step 4: Verify production**

Check:
- `https://dev.tools.herocraft.com/search-app`
- `https://dev.tools.herocraft.com/search-app/api/...` health-bearing route
- report generation path from UI

**Step 5: Commit**

No git commit required for infrastructure-only state.
