# Unified Review Dashboard — Full Plan

## Problem

The review-parser has two separate modes (report + alert) that duplicate infrastructure and require separate runs. The goal is to replace them with a single unified pipeline and eventually expose it as a FastAPI server integrated with the Lead Finder UI.

---

## Mandatory Constraints for This Rollout

These constraints are required and are part of implementation scope:

1. **Persistence/API foundation before full UI integration**
   - Store structured artifacts from each run (themes, classifications, alerts, stats, model metadata).
   - Markdown remains export format, but structured data is the source of truth.
2. **Alert reliability + data freshness**
   - Avoid stale-cache blind spots for monitoring paths.
   - Add minimum absolute spike threshold and robust baseline fallback to reduce false positives on sparse history.
3. **Backward compatibility during migration**
   - Keep `--mode report|alert` and existing docker usage as deprecated aliases to unified mode during transition.
   - Remove legacy flags only in a later cleanup phase.
4. **Single README policy**
   - Keep exactly one canonical README at `review-parser/README.md`.
   - Remove per-app README files (`lead-finder/README.md`, `frontend/README.md`) and merge their operational content into the canonical README.
   - Use docs under `review-parser/docs/` for deep technical plans, but keep entrypoint documentation centralized.

---

## Architecture Overview

### Current State

Two independent pipelines with significant overlap:

| Aspect | Report Mode (`analyzer.py`) | Alert Mode (`classifier.py` + `alerts.py`) |
|--------|---------------------------|-------------------------------------------|
| Batch size | 50 reviews | 30 reviews |
| API calls per batch | 1 (theme extraction) | 1 (classification) |
| Output per batch | Aggregated themes (name, sentiment, severity, count, quotes) | Per-review classification (category, subcategory, device, confidence, summary) |
| Post-processing | Fuzzy merge themes, executive summary (1 API call) | Local anomaly detection, then alert report (1 API call) |
| Total API calls | N + 1 (batches + summary) | M + 1 (batches + alert report) |

Shared infrastructure duplicated across files:
- `_call_model()` — identical in `analyzer.py`, `classifier.py`, `alerts.py` (3 copies)
- `_load_prompt()` — identical in all 3 files
- `_chunked()` — identical in `analyzer.py` and `classifier.py`
- `_extract_json_text()` — nearly identical in `analyzer.py` and `classifier.py`
- `_parse_date()` — identical in `analyzer.py` and `alerts.py`
- Semaphore pattern — identical in `analyzer.py` and `classifier.py`
- Anthropic client setup (api key, model) — triplicated

### Target State (after all phases)

```
Browser ──SSE──> FastAPI server ──> unified pipeline ──> Claude API
                    │                    │
                    │              ┌─────┴─────┐
                    │              │           │
                    │         theme extract  classify
                    │         (parallel, shared semaphore)
                    │              │           │
                    │              └─────┬─────┘
                    │                    │
                    │              detect_alerts (local)
                    │                    │
                    │              unified_report prompt (1 API call)
                    │                    │
                    ▼                    ▼
              Lead Finder UI ◄── MD report + structured data
```

### Key Design Decision: Parallel Pipelines, Not Merged Prompts

**Don't merge prompts — run pipelines in parallel.** Reasons:

1. **Different output shapes**: `analyze_batch` returns aggregated themes (fewer objects than reviews). `classify_batch` returns exactly one object per review. Aggregation vs. annotation.
2. **Different optimal batch sizes**: Theme extraction works well at 50 reviews (it groups), classification works better at 30 (per-review output = more tokens).
3. **Prompt complexity**: A combined prompt would double output token budget and increase error rate.
4. **Reliability**: Each prompt is proven and well-tuned. Combining them introduces re-tuning risk.

**The right approach**: run both pipelines in parallel on the same reviews with a shared semaphore (size 6). Total wall-clock time is `max(N, M)` batch rounds instead of `N + M`.

### API Call Comparison

| | Before (report + alert separately) | After (unified) |
|---|---|---|
| Theme batches | N calls (sequential) | N calls (parallel with classify) |
| Classify batches | M calls (sequential) | M calls (parallel with themes) |
| Executive summary | 1 call | 0 |
| Alert report | 1 call | 0 |
| Unified report | 0 | 1 call |
| **Total** | **N + M + 2** | **N + M + 1** |
| **Wall-clock** | **N + M + 2 rounds** | **max(N, M) + 1 rounds** |

---

## Phase 0: Persistence Foundation (Structured Artifacts)

### Goal
Introduce a storage layer for structured outputs so the dashboard/API can consume data without parsing markdown.

### New Files

| File | Role |
|------|------|
| `storage.py` | Persist/load structured run artifacts (JSON now; DB adapter-ready interface) |

### Implementation

1. Add `run_id` for each unified pipeline execution
2. Persist artifact bundle:
   - input metadata (package, langs, country, fetched_at)
   - pipeline outputs (themes, classifications summary, alerts, stats)
   - generation metadata (model, prompt versions, created_at)
3. Keep markdown generation as output export, but not the primary machine-readable output

### Verification

1. Running unified mode produces markdown **and** one structured artifact file per run
2. Structured artifact can be used to rebuild key dashboard sections without re-calling LLM

---

## Phase 1: Unified Pipeline + MD Report

### Goal
Replace separate report/alert modes with a single unified pipeline that runs theme extraction and classification in parallel, produces one combined MD report, and improves monitoring reliability.

### New Files

| File | Role |
|------|------|
| `utils.py` | Shared utilities: `load_prompt`, `chunked`, `extract_json_text`, `parse_date`, `call_model`, `get_client`, `compact_review`, `review_stats` |
| `pipeline.py` | Unified orchestrator: runs theme extraction + classification in parallel (shared semaphore of 6), then `detect_alerts()` locally, then one unified report prompt |
| `report_builder.py` | Builds the unified MD report from pipeline output |
| `prompts/unified_report.txt` | Single final synthesis prompt (replaces `executive_summary.txt` + `alert_report.txt`) |

### Refactored Files

| File | Changes |
|------|---------|
| `analyzer.py` | Remove duplicated utilities, import from `utils.py`. Keep `_analyze_batch`, `_merge_themes`, `_normalize_theme`, `_themes_match`. Export `run_theme_extraction(client, model, reviews, semaphore)`. Remove `_build_report()` and `_generate_summary()`. |
| `classifier.py` | Remove duplicated utilities, import from `utils.py`. Keep `_classify_batch`, `_normalize_classification`. Export `run_classification(client, model, reviews, changelog, known_issues, semaphore)`. |
| `alerts.py` | Remove `_call_model()`, `_load_prompt()`, `generate_alert_report()`. Keep `detect_alerts()` and `Alert` namedtuple. Import `parse_date` from `utils.py`. |
| `scraper.py` | Add freshness controls for monitoring (`force_refresh` / configurable TTL in unified/alert paths). |
| `main.py` | Add `_run_dashboard_mode()` calling `run_unified_pipeline()` + `build_unified_report()`. Keep `--mode report|alert` as deprecated aliases to unified mode during migration. |

### Unified Report Structure

```markdown
## Executive Summary (3-4 sentences)
## Alerts & New Issues (alert details, severity, devices, quotes, recommendations)
## Top Issues by Theme (negative/mixed themes)
## What Players Love (positive themes)
## Recommendations (immediate / short-term / monitor)
## All Themes (table)
```

### File Structure After Phase 1

```
review-parser/
  main.py              — simplified CLI, routes to pipeline
  utils.py             — NEW: shared utilities
  pipeline.py          — NEW: unified orchestrator
  report_builder.py    — NEW: unified MD report builder
  analyzer.py          — refactored: theme extraction only
  classifier.py        — refactored: classification only
  alerts.py            — refactored: detection only, no API calls
  scraper.py           — refactored: cache freshness controls for monitoring
  version_tracker.py   — unchanged
  prompts/
    analyze_batch.txt      — unchanged
    classify_batch.txt     — unchanged
    unified_report.txt     — NEW
    executive_summary.txt  — deprecated (kept for reference)
    alert_report.txt       — deprecated (kept for reference)
```

### Implementation Sequence

1. Create `utils.py` — extract shared code
2. Refactor `analyzer.py` — import from utils, export `run_theme_extraction()`
3. Refactor `classifier.py` — import from utils, export `run_classification()`
4. Refactor `alerts.py` — remove API code, keep `detect_alerts()` + add baseline fallback + absolute spike floor
5. Create `prompts/unified_report.txt`
6. Create `report_builder.py`
7. Create `pipeline.py`
8. Update `main.py` with compatibility aliases and deprecation warnings
9. Update `scraper.py` cache policy for monitoring reliability
10. Test with cached and forced-fresh runs

### Verification

1. Run: `python main.py com.herocraft.game.piratearena`
2. Verify unified MD report contains both alert and analysis sections
3. Check that alerts section appears before thematic analysis
4. Compare theme extraction quality against old report output
5. Compare alert detection against old alert output
6. Validate sparse-history alert behavior (no baseline / weak baseline) does not trigger noise-level spikes
7. Validate fresh mode bypasses stale 24h cache for monitoring runs

---

## Phase 2: FastAPI Server

### Goal
Wrap the unified pipeline in a FastAPI server with SSE progress streaming, so the Lead Finder UI can call it.

### New Files

| File | Role |
|------|------|
| `server.py` | FastAPI app with SSE and sync endpoints |

### Endpoints

- `GET /api/report` (SSE) — streams progress events, then the final report. For the Lead Finder UI.
- `GET /api/report/sync` — non-streaming JSON endpoint for programmatic use/testing.
- `GET /health` — for Docker health checks.

### SSE Event Flow

```
→ {"event": "status", "data": {"step": "resolved", "package": "...", "title": "..."}}
→ {"event": "status", "data": {"step": "fetching"}}
→ {"event": "status", "data": {"step": "fetched", "count": 300}}
→ {"event": "progress", "data": {"pipeline": "themes", "current": 3, "total": 6}}
→ {"event": "progress", "data": {"pipeline": "classify", "current": 5, "total": 10}}
→ {"event": "status", "data": {"step": "analyzed"}}
→ {"event": "report", "data": {"markdown": "..."}}
→ {"event": "done", "data": "{}"}
```

### Progress Callback Mechanism

Use `asyncio.Queue` in `pipeline.py`:

```python
async def run_unified_pipeline(..., progress_queue: asyncio.Queue | None = None):
    async def _report_progress(step, current=0, total=0):
        if progress_queue:
            await progress_queue.put({"step": step, "current": current, "total": total})
```

SSE generator reads from the queue and yields events.

### Dependencies

Add to `requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sse-starlette>=2.0.0
```

### Docker Updates

- `entrypoint.sh`: if `MODE=server`, run `uvicorn server:app --host 0.0.0.0 --port 8000`
- `docker-compose.yml`: add `review-api` service on port 8000
- keep legacy `MODE=report|alert` mapping to unified execution (deprecation warning)

### Note on Blocking Scraper

`fetch_reviews()` uses synchronous `google_play_scraper`. In `server.py`, wrap in `asyncio.to_thread()` to avoid blocking the event loop.

---

## Phase 3: Lead Finder UI Integration

### Goal
Add review dashboard capabilities to the Lead Finder Next.js app: URL input block, report viewer drawer, and "Generate Report" button in results table.

### New Components

| Component | Description |
|-----------|-------------|
| `report-input.tsx` | URL input block at top of page for manual report generation |
| `report-viewer.tsx` | Slide-out drawer showing MD report + progress during generation |
| `use-report.ts` | Custom hook managing SSE connection to Python backend |

### UI Layout

```
┌──────────────────────────────────────────┐
│ Header                                    │
├──────────────────────────────────────────┤
│ Review Dashboard                          │
│ [Google Play URL input] [Generate Report] │
├──────────────────────────────────────────┤
│ Lead Scanner                              │
│ [Existing scan form]                      │
├──────────────────────────────────────────┤
│ Results Table                             │
│ ... | Actions |                           │
│ ... | [Report] |  ← new button per row    │
└──────────────────────────────────────────┘
                                    ┌──────────────┐
                                    │ Report Drawer │
                                    │ (slide-out)   │
                                    │ - Progress    │
                                    │ - MD content  │
                                    └──────────────┘
```

### Communication: Browser → FastAPI

**Direct browser-to-FastAPI SSE** (recommended over proxying through Next.js):
- Browser opens `EventSource` to `http://localhost:8000/api/report?url=...`
- Same SSE pattern the Lead Finder already uses for scan
- CORS configured on FastAPI side for `http://localhost:51100`
- Simple, no proxy needed

### Hook Implementation

```typescript
// src/lib/use-report.ts
export function useReport() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReportProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = (url: string) => {
    const es = new EventSource(`${API_URL}/api/report?url=${encodeURIComponent(url)}`);
    es.addEventListener('status', ...);
    es.addEventListener('report', ...);
    es.addEventListener('done', () => { es.close(); });
  };

  return { markdown, progress, isGenerating, generate };
}
```

### New Dependencies for Lead Finder

```bash
npx shadcn@latest add sheet    # drawer component
npm install react-markdown      # MD rendering in drawer
```

### Environment

Add to `lead-finder/.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Documentation Policy (Single README)

- `review-parser/README.md` is the only README entrypoint for the whole project.
- `lead-finder/README.md` and `frontend/README.md` are intentionally removed.
- Any docs references should point to `review-parser/README.md` + relevant `docs/*.md` files.

### Documentation Sync (Replacement)

1. Update only `review-parser/README.md` for onboarding and run instructions.
2. Remove component-level README files (`lead-finder/README.md`, `frontend/README.md`).
3. Normalize references in `CLAUDE.md`, `docs/alert-mode-usage.md`, and relevant `docs/*` plans to the single README policy.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Combined prompt produces worse output | Only the final synthesis prompt is new. Theme extraction and classification prompts remain unchanged. |
| Parallel execution hits rate limits | Shared semaphore (6) limits total concurrent API calls. Can be tuned down. |
| Breaking existing CLI usage | Keep legacy modes as deprecated aliases during migration; remove in later cleanup phase. |
| FastAPI scraper blocks event loop | Wrap `fetch_reviews()` in `asyncio.to_thread()`. |

---

## Deferred for Later (Post-MVP Backlog)

These are important but intentionally deferred until core unification ships.

1. **API security and abuse controls**
   - Add auth (service token/JWT), request quotas, and per-key rate limiting for expensive LLM endpoints.
2. **Stable SSE contract + versioning**
   - Freeze event schema (`type`, payload shape), add `schema_version`, keep compatibility with existing Lead Finder event handling.
3. **Cancellation and disconnect handling**
   - Stop background pipeline on client disconnect; add cooperative cancellation + stage timeouts.
4. **Automated testing baseline**
   - Add unit + contract + smoke tests for pipeline/API; remove purely manual-only verification.
5. **Persistent known-issues lifecycle**
   - Implement storage and dedup flow for `known_issues` across runs (with status/TTL).
6. **Prompt context budgeting**
   - Add deterministic context builder with hard caps (quotes/themes/alerts) and overflow fallback path.
