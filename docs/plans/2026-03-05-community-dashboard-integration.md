# Plan: Community Data Integration into GamePulse Dashboard

## Context

We're executing **Milestone 1: Cross-Source MVP** from `docs/gamepulse-roadmap.md` — specifically phases 1.2 (TG Bridge), 1.4 (Pipeline Integration), and 1.5 (UI Cross-Analysis View), scoped to **Google Play + Telegram only** (no Apple yet).

**Problem:** The dashboard currently shows only Google Play reviews. Telegram community data (3,957 messages for Space Arena, classified into 1,787 signals) exists as processed JSON but isn't visible in the dashboard.

**Goal:** Unified dashboard where GP reviews and TG community signals appear together with source indicators, filters, and three new community-specific widgets. Data flows through `runtime-mapper.ts` from static JSON — no `server.py` changes.

**Key roadmap concepts to implement:**
- **Confirmed Issues** — topics appearing in both GP and TG
- **Store Blind Spots** — issues in community but absent from store reviews
- **Chat Blind Spots** — issues in store but absent from community
- **Sentiment Gaps** — same topic, different sentiment across sources

---

## Decisions

| Decision | Choice |
|----------|--------|
| Integration model | Unified view — both sources in same widgets, GP/TG icons, source filter |
| Scope | Frontend + mapper (no server.py changes), static JSON loading |
| Taxonomy | Dual: map to GP categories for KPIs, preserve original topic as subcategory |
| New widgets | Community Pulse + Source Comparison + Thread Highlights |

---

## Implementation Steps

### Step 1: Type System

**Modify** `frontend/src/lib/types.ts`
- Add `FeedbackSource = "google_play" | "community"`
- Add `source: FeedbackSource` to `Review` interface
- Add optional fields: `communityTopic?: string`, `communityUsername?: string`, `communityMsgId?: string`
- Add interfaces: `CommunityPulseStats`, `CommunityThread`, `SourceComparisonItem`

**Modify** `frontend/src/lib/dashboard-types.ts`
- Add to `DashboardData`: `communityPulse?`, `communityThreads?`, `sourceComparison?`, `communityDataLoaded: boolean`

**Modify** `frontend/src/lib/dashboard-config.ts`
- Extend `DashboardWidgetKey` with `"community_pulse" | "source_comparison" | "community_threads"`
- Add new widgets to role defaults (producer gets all 3, support gets pulse+threads, engineering gets pulse+comparison)

### Step 2: Community Data Types & Mapper

**Create** `frontend/src/lib/community-types.ts`
- TypeScript interfaces for raw community JSON (`CommunityDataFile`, `CommunityMessage`, `CommunityNoiseMessage`)

**Create** `frontend/src/lib/community-mapper.ts`
Core mapping module:

- **Topic-to-category table:**
  - `bugs` -> `bug`, `feature_request` -> `feature`, `content_update` -> `feature`
  - `ships/events/progression/game_balance/modules/pilots/monetization/support/ux` -> `complaint`
  - `community` -> `noise`
- **`mapCommunityToReviews()`** — converts classified messages to `Review[]` with `source: "community"`, synthetic ratings (negative=2, neutral=3, positive=5), `lang: "ru"`, `country: "TG"`
- **`buildCommunityPulseStats()`** — signal ratio, top topics, sentiment breakdown, 7-day daily volume
- **`buildCommunityThreads()`** — group by topic+day, take top-3 hottest pseudo-threads
- **`buildSourceComparison()`** — cross-source analysis producing confirmed issues, blind spots, sentiment gaps

### Step 3: Data Loading

**Create** `frontend/src/app/api/community/route.ts`
- Simple API route reading `../data/space_arena_community_30d.json` and serving it
- Returns 404 if file not found (graceful fallback)

**Create** `frontend/src/hooks/use-community-data.ts`
- Fetches `/api/community`, runs mapper functions, memoizes results
- Returns `{ communityReviews, communityPulse, communityThreads, loading, error }`

**Modify** `frontend/src/hooks/use-dashboard-data.ts`
- After GP data loads, fetch community data in parallel
- Merge: concatenate reviews, set community fields on DashboardData, re-run `buildClusters()` on unified reviews
- Set `communityDataLoaded = true`

### Step 4: Runtime Mapper Update

**Modify** `frontend/src/lib/runtime-mapper.ts`
- One-line change: add `source: "google_play" as const` to the Review object in `buildReviews()` (~line 224)

### Step 5: i18n

**Modify** `frontend/src/lib/i18n.ts`
- Add EN/RU text for: `communityPulse`, `sourceComparison`, `communityThreads`, `sourceFilter` sections
- Add community topic labels (ships/events/progression/etc.) in both languages

### Step 6: Source Filter

**Create** `frontend/src/components/command-center/source-filter-toggle.tsx`
- Segmented control: All / Store (GP icon) / Community (TG icon)
- Uses existing Button/Toggle shadcn components
- Hidden when `communityDataLoaded` is false

**Modify** `frontend/src/hooks/use-filters.ts`
- Add `source: FeedbackSource | null` to `ReviewFilters`

### Step 7: New Widget Components

**Create** `frontend/src/components/command-center/community-pulse.tsx`
- KPI card with purple accent stripe
- Signal ratio %, top-3 topics as badges, sentiment bar, 7-day sparkline (Recharts `<Line>`)

**Create** `frontend/src/components/command-center/source-comparison.tsx`
- Grouped bar chart (Recharts `<BarChart>`) comparing GP vs TG volumes by category
- Below chart: "Cross-Source Insights" section showing:
  - Confirmed Issues (in both sources)
  - Store Blind Spots (only in TG)
  - Chat Blind Spots (only in GP)
  - Sentiment Gaps (same topic, different sentiment)

**Create** `frontend/src/components/command-center/community-threads.tsx`
- Top-3 hot threads with topic badge, message count, negative count, summary, sentiment badge
- Card-based layout similar to TopClusters

### Step 8: Source Indicators in Existing Widgets

**Modify** `frontend/src/components/command-center/top-clusters.tsx`
- Add source breakdown per cluster: `GP: 12 · TG: 45`

**Modify** `frontend/src/components/reviews/review-table.tsx`
- Add Source column with GP/TG icon
- Show `communityUsername` in expanded detail

**Modify** `frontend/src/components/reviews/review-filters.tsx`
- Add Source filter dropdown (All / Google Play / Community)

### Step 9: Dashboard Page Integration

**Modify** `frontend/src/app/command-center/page.tsx`

New layout:
```
[Source Filter Toggle]                          -- new, hidden when no community data
[Status Cards (3 cols)] [Community Pulse]        -- pulse as 4th card
[Timeline]
[Source Comparison]                              -- new cross-analysis widget
[Top Clusters | Action Board | Community Threads] -- 3-col when threads visible
```

All widgets conditionally rendered via `visibleWidgets.has()` + data availability checks. When no community data, layout stays exactly as before.

### Step 10: Dashboard Customizer Labels

**Modify** `frontend/src/components/command-center/dashboard-customizer.tsx`
- Add labels for 3 new widgets in `labelForWidget()`

---

## File Summary

| Action | File | Size |
|--------|------|------|
| MODIFY | `frontend/src/lib/types.ts` | Add source type, community interfaces |
| MODIFY | `frontend/src/lib/dashboard-types.ts` | Add community fields to DashboardData |
| MODIFY | `frontend/src/lib/dashboard-config.ts` | New widget keys, role defaults |
| CREATE | `frontend/src/lib/community-types.ts` | Raw JSON TypeScript interfaces |
| CREATE | `frontend/src/lib/community-mapper.ts` | Core: topic mapping, review conversion, pulse/thread/comparison builders |
| CREATE | `frontend/src/app/api/community/route.ts` | Static JSON serving |
| CREATE | `frontend/src/hooks/use-community-data.ts` | Fetch + process community data |
| MODIFY | `frontend/src/hooks/use-dashboard-data.ts` | Merge community into DashboardData |
| MODIFY | `frontend/src/hooks/use-filters.ts` | Source filter |
| MODIFY | `frontend/src/lib/runtime-mapper.ts` | One-liner: `source: "google_play"` |
| MODIFY | `frontend/src/lib/i18n.ts` | EN/RU text for community widgets |
| CREATE | `frontend/src/components/command-center/source-filter-toggle.tsx` | Source toggle UI |
| CREATE | `frontend/src/components/command-center/community-pulse.tsx` | KPI card |
| CREATE | `frontend/src/components/command-center/source-comparison.tsx` | Cross-analysis chart + insights |
| CREATE | `frontend/src/components/command-center/community-threads.tsx` | Hot threads widget |
| MODIFY | `frontend/src/app/command-center/page.tsx` | Wire new widgets + filter |
| MODIFY | `frontend/src/components/command-center/top-clusters.tsx` | Source breakdown |
| MODIFY | `frontend/src/components/command-center/dashboard-customizer.tsx` | New widget labels |
| MODIFY | `frontend/src/components/reviews/review-table.tsx` | Source column |
| MODIFY | `frontend/src/components/reviews/review-filters.tsx` | Source filter dropdown |

**7 new files, 13 modified files**

---

## Key Reusable Code

- `runtime-mapper.ts:buildClusters()` — reuse for unified clusters (GP+TG reviews together)
- `runtime-mapper.ts:buildTimeline()` — reuse for unified timeline
- `runtime-mapper.ts:categoryFromApi()` — pattern reference for community topic mapping
- `dashboard-config.ts:buildDefaultDashboardConfig()` — extend, don't replace
- `use-dashboard-data.ts` — merge point, not replacement
- shadcn/ui: `Card`, `Badge`, `Button`, `Select` — for all new widgets

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| No star ratings in community | Synthetic ratings from sentiment (neg=2, neu=3, pos=5) |
| Community topics dominate clusters | Source filter toggle lets user isolate GP-only view |
| 1.6 MB JSON load | Single fetch, in-memory cache, no localStorage |
| Date range mismatch GP vs TG | Existing date filters handle this naturally |
| No explicit thread structure in TG data | Pseudo-threads via topic+day grouping |

---

## Verification

1. `cd frontend && npm run dev` — dashboard loads without errors
2. `/command-center` shows 3 new community widgets when data is available
3. Source filter toggle (All/Store/Community) filters all widgets correctly
4. Remove community JSON file — dashboard falls back to GP-only, no errors
5. Switch EN/RU — all new text renders in both languages
6. `/reviews` page shows Source column with GP/TG icons
7. Dashboard customizer shows new widgets, can toggle them on/off
8. `npm run build` — no TypeScript errors
