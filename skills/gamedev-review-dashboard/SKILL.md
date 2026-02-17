---
name: gamedev-review-dashboard
description: "Create production-ready KPI dashboards for game analytics with focus on Voice of Customer (VoC), store reviews, support ops, and live ops monitoring. Use when building dashboards for game studios to monitor: (1) Store reputation and review analytics, (2) Player feedback from multiple sources (stores, community, support), (3) LiveOps and A/B test impact, (4) Support team performance, (5) Game health metrics (crashes, payments, backend). Specialized for mid-size game studios managing live games."
---

# Gamedev Review Dashboard

Create actionable, management-focused dashboards for analyzing app store reviews, player feedback, and game health metrics for game development studios.

## Core Philosophy

**This skill creates "management dashboards", not "data showcases".**

Every metric is tied to a decision. Every view helps answer: *Is something on fire? Where? Why? Who owns the fix?*

## When to Use This Skill

Use this skill when the user asks to:
- Build a dashboard for game analytics or player feedback
- Create a VoC (Voice of Customer) monitoring system
- Design a store review analytics dashboard
- Build a support ops performance dashboard
- Create a LiveOps impact monitoring dashboard
- Monitor game health metrics (crashes, payments, ratings)

## Dashboard Types

### 1. Game Command Center (Full Dashboard)

The main operational dashboard with 7 Essential States:
- **Payments**: Payment success rate, funnel drops, provider errors
- **Revenue**: Gross/net revenue, ARPDAU, payer conversion
- **Stability**: Crash-free sessions, top crashes by version/device
- **Backend/API**: Availability, error rate, latency, login success
- **Store Reputation**: Rating (7d rolling), review velocity, top negative themes
- **Support**: Ticket inflow/solved, backlog, first reply time, SLA risk
- **VoC**: Unified feedback volume, sentiment, emerging issues

**Layout:** See [dashboard-principles.md](references/dashboard-principles.md) for complete structure.

### 2. VoC Focus Dashboard

Specialized dashboard focusing only on Voice of Customer analytics:
- Unified feedback from stores + community + support
- Issue clusters with trending
- Sentiment analysis
- Topic distribution
- Version/platform/region segmentation

**Data model:** See [voc-layer.md](references/voc-layer.md) for unified feedback structure.

### 3. Support Ops Dashboard

Support team performance and queue health:
- Queue health (inflow, backlog, aging, SLA risk)
- Agent scorecards (load, speed, quality, impact)
- Quality metrics (CSAT, FCR, reopen rate)
- Product impact (escalations, bug reports)

**Metrics:** See [support-ops.md](references/support-ops.md) for detailed metrics.

## Quick Start

### Step 1: Understand Requirements

Ask clarifying questions:
1. **Dashboard type**: Full Command Center, VoC-only, or Support Ops?
2. **Data sources**: Which stores/platforms (iOS, Android, Steam, PC)? Community channels? Support system?
3. **Key pain points**: What decisions need to be made faster? What's currently "blind"?
4. **Team size**: How many people manage support/community/analytics?
5. **Tech stack**: React/Vue/Angular? Backend API available? Real-time or batch updates?

### Step 2: Design Layout

Based on dashboard type, use layouts from [dashboard-principles.md](references/dashboard-principles.md):

- **Game Command Center**: Full 7-state layout with triage timeline
- **VoC Dashboard**: Issue clusters + sentiment trends + topic breakdown
- **Support Ops**: Queue health + agent scorecards + escalations

### Step 3: Implement Components

Use template components from `assets/`:

- `EssentialStateCard.tsx` - For Essential States (traffic light cards)
- `IssueClusterCard.tsx` - For VoC issue clusters
- `TriageTimeline.tsx` - For 24h multi-metric timeline with event markers
- `types.ts` - TypeScript type definitions

**Customize colors, metrics, and labels** based on user's brand and specific KPIs.

### Step 4: Define Metrics

Reference detailed metric definitions:
- **Essential States**: [essential-states.md](references/essential-states.md)
- **VoC Layer**: [voc-layer.md](references/voc-layer.md)
- **Support Ops**: [support-ops.md](references/support-ops.md)

### Step 5: Add Interactivity

Standard interactive features:
- **Filters**: Date range, platform, version, region, segment
- **Drill-down**: Click card → detailed view with breakdowns
- **Exports**: PNG screenshot, CSV data, JSON API, shareable link
- **Real-time updates**: WebSocket for Essential States, 1-min refresh for charts

See [dashboard-principles.md](references/dashboard-principles.md) → "Interactivity Patterns".

## Design Standards

### Visual Hierarchy

```
Primary metrics:   2.5rem (40px) - The main number
Secondary metrics: 1.5rem (24px) - Delta/comparison
Labels:           0.875rem (14px) - Metric names
Micro labels:     0.75rem (12px) - Units, timestamps
```

### Color Coding (Traffic Light)

```typescript
🟢 Green #22c55e - Within baseline ±10%
🟡 Yellow #f59e0b - 10-30% degradation
🔴 Red #ef4444 - >30% degradation or critical
⚪ Gray #6b7280 - No data / N/A
```

### Spacing

- Card padding: 1.5rem (24px)
- Card gap: 1rem (16px)
- Section gap: 2rem (32px)

## Key Patterns

### Pattern 1: Essential State Card

Shows health status at a glance:
- Traffic light color (green/yellow/red)
- Primary metric (large number)
- Delta vs baseline (with arrow)
- Context (owner, since when, top issue)

```tsx
<EssentialStateCard
  title="PAYMENTS"
  status="red"
  primaryMetric={{ value: "94.7%", label: "success rate" }}
  delta={{ value: "-2.1pp", label: "vs 7d baseline" }}
  context={{
    topIssue: "3DS timeout (iOS)",
    owner: "@monetization",
    since: "2h ago"
  }}
/>
```

### Pattern 2: Issue Cluster (VoC)

Groups similar feedback from multiple sources:
- Severity (P0/P1/P2) and status
- Volume + trend vs baseline
- Sources breakdown (reviews + tickets + community)
- Affected segments (version/platform/region)
- Example quotes (3-5)

See `assets/IssueClusterCard.tsx` for implementation.

### Pattern 3: Triage Timeline

Multi-metric 24h timeline with event markers:
- 4 key metrics: Revenue, Payment Success, Crash-Free, Negative Feedback
- Event markers: releases, LiveOps, incidents, config changes
- Helps answer: "What changed when things broke?"

See `assets/TriageTimeline.tsx` for implementation.

## Decision Scenarios

### Scenario 1: "Payments Down"

Dashboard guides user through:
1. Essential State "Payments" → 🔴 Red
2. Timeline shows marker: release/config/provider incident
3. VoC radar: spike in payment tickets + reviews
4. Action board: incident → owner → playbook

**Time to decision: <3 minutes**

### Scenario 2: "Negative Spike After Patch"

Dashboard reveals:
1. Stability → crash-free dropping
2. Store reputation: recent score falling
3. Release markers: coincides with latest build
4. Decision: stop rollout / rollback / hotfix

**Time to decision: <5 minutes**

## Best Practices

1. **Limit to 5-7 KPIs per view** - Prevent information overload
2. **Show trends + comparisons** - Always include delta vs baseline
3. **Default segments** - Version/platform/region/language filters
4. **Unified VoC** - Merge stores + community + support into one view
5. **Balance speed × quality** - For support metrics, never optimize only for volume
6. **Event markers** - Always show releases/deploys/LiveOps on timelines
7. **Mobile responsive** - Essential States first, then progressive disclosure

## Chart Type Selection

| Data Type | Chart Type | Use Case |
|-----------|-----------|----------|
| Time series | Line chart | Revenue, DAU, rating over time |
| Comparison | Bar chart | Platform/version comparison |
| Part-to-whole | Donut chart | Error distribution, platform share |
| Funnel | Funnel chart | Purchase funnel, FTUE funnel |
| Distribution | Histogram | Response time distribution |
| Multi-metric | Multi-line | Triage timeline (4 metrics) |

## Progressive Disclosure

**For comprehensive guidance**, reference files are organized by topic:

- **[essential-states.md](references/essential-states.md)** - 7 Essential States: detailed metrics, color rules, event markers
- **[voc-layer.md](references/voc-layer.md)** - VoC unified data model, clustering, topic dictionary
- **[support-ops.md](references/support-ops.md)** - Support metrics, agent scorecards, queue health
- **[dashboard-principles.md](references/dashboard-principles.md)** - Layout strategy, visual hierarchy, interactivity patterns, decision scenarios

**When to read references:**
- Building full Game Command Center → Read all reference files
- VoC dashboard only → Read voc-layer.md
- Support ops only → Read support-ops.md
- Need visual design details → Read dashboard-principles.md
- Need metric definitions → Read essential-states.md

## Tech Stack Recommendations

**Frontend:**
- React + TypeScript (production)
- Recharts or Chart.js for visualizations
- Tailwind CSS for styling
- WebSocket or SSE for real-time updates

**Backend:**
- FastAPI (Python) or Express (Node.js)
- PostgreSQL or ClickHouse for time-series data
- Redis for caching and real-time aggregations
- Bull or Celery for background jobs (review fetching, clustering)

**Data Sources:**
- Google Play Developer API (reviews)
- App Store Connect API (reviews)
- Steam Web API (reviews)
- Discord webhooks + Reddit API (community)
- Zendesk/Intercom/Freshdesk API (support)

## Output

Create production-ready dashboard code:
1. **Components** - React/TypeScript components with proper typing
2. **API contracts** - TypeScript interfaces for backend responses
3. **Mock data** - For testing without live data sources
4. **Documentation** - Brief setup and customization guide

Use template components from `assets/` as foundation. Customize based on user's:
- Brand colors
- Specific KPIs
- Data sources
- Team structure
