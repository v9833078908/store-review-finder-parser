# Review Analytics Dashboard — Frontend Design Plan

## Context

The project currently generates markdown reports and alert reports via CLI (`main.py`). The ТЗ requires a web-based dashboard that answers 3 questions: (1) What hurts players now? (2) Is it related to a release/version/device/region? (3) What are we doing about it? The dashboard will be created in a `frontend/` directory with mock data, to later connect to a FastAPI backend.

## Tech Stack (matching lead-finder)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui (new-york style, neutral base) |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Charts | Recharts (via shadcn/ui chart components) |
| Fonts | Geist Sans / Geist Mono |
| Port | **51200** (frontend range per Bell Kit) |
| Language | TypeScript |

## Architecture

```
frontend/
├── package.json
├── next.config.ts
├── tsconfig.json
├── components.json                 # shadcn/ui config
├── postcss.config.mjs
├── .env.example
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with sidebar
│   │   ├── globals.css             # Copied from lead-finder
│   │   ├── page.tsx                # Redirect to /command-center
│   │   ├── command-center/
│   │   │   └── page.tsx            # Screen 1: Command Center
│   │   ├── issues/
│   │   │   ├── page.tsx            # Screen 2: Issues list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Cluster detail view
│   │   ├── reviews/
│   │   │   └── page.tsx            # Screen 3: Reviews Explorer
│   │   └── alerts/
│   │       └── page.tsx            # Alerts list
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── layout/
│   │   │   ├── sidebar.tsx         # App sidebar navigation
│   │   │   └── header.tsx          # Top bar with product selector
│   │   ├── command-center/
│   │   │   ├── status-cards.tsx    # 3 Essential State cards
│   │   │   ├── timeline-chart.tsx  # 24h timeline with release markers
│   │   │   ├── top-clusters.tsx    # Top 5 Issue Clusters
│   │   │   └── action-board.tsx    # Action items table
│   │   ├── issues/
│   │   │   ├── cluster-list.tsx    # Clusters table with sorting
│   │   │   └── cluster-detail.tsx  # Detail: summary, examples, breakdowns
│   │   ├── reviews/
│   │   │   ├── review-filters.tsx  # Filter bar (rating, lang, country, version, category)
│   │   │   └── review-table.tsx    # Reviews table with expandable rows
│   │   └── alerts/
│   │       └── alert-list.tsx      # Alerts feed with severity badges
│   ├── lib/
│   │   ├── mock-data.ts           # All mock data in one file
│   │   ├── types.ts               # TypeScript interfaces
│   │   └── utils.ts               # Utility functions (cn, formatters)
│   └── hooks/
│       └── use-filters.ts         # Shared filter state hook
```

## Screens Design

### Screen 1: Command Center (`/command-center`)
**Goal: understand "горит/не горит" in 2 minutes**

- **3 Essential State Cards** (top row):
  - **Reputation**: current rating (4.49), trend arrow, 1-2 star share (12%), change from last week
  - **New Issues**: count of new clusters since last release (3), spike indicator, critical count
  - **Response Coverage**: % reviews without reply (67%), unanswered negatives count
- **Timeline Chart** (middle): 7-day volume chart (negative reviews, bug reports, alerts). Release version markers on X-axis
- **Top 5 Issue Clusters** (left bottom): table with cluster name, severity badge, volume trend sparkline, top languages/countries. Click → opens `/issues/[id]`
- **Action Board** (right bottom): table of action items with owner, status badge, next checkpoint date

### Screen 2: Issues / Clusters (`/issues`)
**Goal: understand "what exactly" and prepare a fix**

- **Cluster List** page: sortable/filterable table of all clusters with severity, volume, trend, first/last seen
- **Cluster Detail** page (`/issues/[id]`):
  - Auto-generated summary
  - "Why we think this is a problem" section (growth rate, rating impact)
  - 5-10 example reviews with ratings and dates
  - Breakdown cards: by version, by country, by language (bar charts)
  - Recommended action (hotfix/FAQ/template/escalation)

### Screen 3: Reviews Explorer (`/reviews`)
**Goal: manual analysis for QA/producer/support lead**

- **Filter Bar**: rating (1-5 stars), language, country, version, theme, category (bug/feature/praise/noise)
- **Sortable Table**: date, rating, text (expandable), category badge, sentiment, theme tags, severity
- **Export**: CSV download button

### Screen 4: Alerts (`/alerts`)
**Goal: signal feed with actionable context**

- **Alert Feed**: chronological list of alerts with type icon, severity badge, description
- Alert types: new critical cluster, spike >2x, rating drop, region outbreak
- Each alert links to related cluster or shows inline context

## Mock Data Structure

Based on ТЗ entities and real report data from `reports/`:

```typescript
// Product
{ id: "pirate-ships", name: "Pirate Ships Build and Fight", packageId: "com.example.pirateships", platform: "google_play", rating: 4.49, totalReviews: 15420 }

// Reviews (50+ mock reviews with realistic data from actual reports)
{ id, productId, rating, text, lang, country, appVersion, category, subcategory, sentiment, themes, severity, createdAt }

// Clusters (based on actual theme extraction results)
{ id, title, severity, volume24h, volume7d, ratingAvg, topLangs, topCountries, topVersions, firstSeen, lastSeen, status, reviews[] }

// Alerts (based on actual alert report format)
{ id, type, severity, metric, baseline, current, clusterId, detectedAt, status }

// Action Items
{ id, type, owner, status, relatedClusterId, nextCheckAt, notes }
```

## Implementation Steps

### Step 1: Project scaffolding
- `npx create-next-app@latest frontend` with TypeScript, Tailwind, App Router
- Configure port 51200 in package.json scripts
- Init shadcn/ui with same config as lead-finder (new-york style, neutral base)
- Add Recharts dependency
- Add shadcn components: card, badge, button, input, select, table, tabs, chart, separator, avatar, dropdown-menu, sidebar, tooltip, sheet

### Step 2: Types & Mock Data
- Create `src/lib/types.ts` with all interfaces
- Create `src/lib/mock-data.ts` with realistic data from actual reports

### Step 3: Layout (sidebar + header)
- Sidebar with navigation: Command Center, Issues, Reviews, Alerts
- Header with product selector dropdown and last-updated timestamp
- Use shadcn Sidebar component

### Step 4: Command Center page
- StatusCards component (3 cards)
- TimelineChart with Recharts area chart + release markers
- TopClusters component (clickable table)
- ActionBoard component (table with status badges)

### Step 5: Issues pages
- ClusterList page with sortable table
- ClusterDetail page with summary, examples, breakdown charts

### Step 6: Reviews Explorer page
- ReviewFilters component
- ReviewTable with expandable rows, category badges

### Step 7: Alerts page
- AlertList component with severity badges, linked clusters

### Step 8: Use /frontend-design skill for visual polish
- Apply distinctive design to all components
- Ensure dark mode support via globals.css

## Verification
1. `cd frontend && npm install && npm run dev`
2. Open http://localhost:51200
3. Verify all 4 screens render with mock data
4. Check sidebar navigation works
5. Verify responsive layout on different viewport sizes
6. Verify dark mode toggle (if implemented)
