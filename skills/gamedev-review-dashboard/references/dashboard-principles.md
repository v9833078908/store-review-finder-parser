# Dashboard Design Principles

## Core Principles (What Makes a Dashboard "Actionable", Not Just "Pretty")

1. **One screen = situation management.** Everything else is drill-down.

2. **Every metric tied to a decision.** Each block has an *owner* and *playbook* ("what to do if red").

3. **Look at changes, not absolutes.** Everywhere has baseline comparison (e.g., 7 days) and "how long in degradation".

4. **Default segments:** *version/platform/region/language* - otherwise you won't find the root cause (especially for reviews and payments).

5. **VoC - unified layer:** stores + community + support merge into common **themes/clusters** and "impact score".

6. **Support - not by "tickets closed" but by balance speed×quality×product impact.** Otherwise people start "volume grinding" and worsen CSAT/repeat contacts.

---

## Layout Strategy: Game Command Center

```
┌────────────────────────────────────────────────────────────────┐
│ FILTERS: period | platform | region | version | segment         │
├────────────────────────────────────────────────────────────────┤
│ ESSENTIAL STATES (7 cards, traffic lights):                    │
│ Payments | Revenue | Stability | Backend | Store Rep | Support │
├────────────────────────────────────────────────────────────────┤
│ TRIAGE TIMELINE (24h): Revenue ~ Payment success ~ Crash-free  │
│ + markers: release / remote-config / liveops / provider issues │
├────────────────┬────────────────┬──────────────────────────────┤
│ MONEY          │ PLAYERS        │ VoC RADAR                    │
│ (health KPIs)  │ (health KPIs)  │ (Issues, Sentiment, Rating)  │
├────────────────────────────────────────────────────────────────┤
│ LIVEOPS & EXPERIMENTS: Active events | A/B tests | Impact      │
├────────────────────────────────────────────────────────────────┤
│ ACTION BOARD: Incidents + Growth hypotheses                    │
│ (owner | next action | ETA | KPI)                             │
└────────────────────────────────────────────────────────────────┘
```

---

## Visual Hierarchy

### Typography Scale
- **Primary metrics:** 2.5rem (40px) - The main number
- **Secondary metrics:** 1.5rem (24px) - Delta/comparison
- **Labels:** 0.875rem (14px) - Metric names
- **Micro labels:** 0.75rem (12px) - Units, timestamps

### Color Coding (Traffic Light System)
```typescript
const STATUS_COLORS = {
  green: '#22c55e',   // Within baseline ±10%
  yellow: '#f59e0b',  // 10-30% degradation
  red: '#ef4444',     // >30% degradation or critical
  gray: '#6b7280',    // No data / N/A
};
```

### Spacing
- Card padding: 1.5rem (24px)
- Card gap: 1rem (16px)
- Section gap: 2rem (32px)

---

## Component Patterns

### 1. Essential State Card

```
┌─────────────────────────────────┐
│ 🟢 PAYMENTS                     │
│                                 │
│ 96.8%      ↓ -2.1pp            │
│ success    vs 7d baseline       │
│                                 │
│ Top issue: 3DS timeout (iOS)    │
│ Owner: @monetization            │
│ Since: 2h ago                   │
└─────────────────────────────────┘
```

Key elements:
- Status indicator (color + icon)
- Primary metric (large)
- Delta vs baseline (with arrow)
- Context (top issue/owner/timing)

---

### 2. Trend Chart with Event Markers

```
Revenue (24h)
│
│     ×release        ▲event
│    ╱                ╱╲
│   ╱                ╱  ╲___
│  ╱  ______________╱
│ ╱__╱
└────────────────────────────
  00:00    06:00    12:00    18:00
```

Markers:
- × Release
- ▲ LiveOps start
- ▼ LiveOps end
- ⚠ Incident
- ⚙ Remote config change

---

### 3. Issue Cluster Card (VoC)

```
┌────────────────────────────────────────┐
│ 🔴 P0: Payment errors on iOS 1.2.3    │
│                                        │
│ Volume: 146 items (+340% vs baseline) │
│ Sources: 45 reviews + 89 tickets       │
│          + 12 Discord                  │
│                                        │
│ Affected: iOS 1.2.3 | US, UK, CA      │
│ Owner: @monetization | Status: Fixing  │
│                                        │
│ Examples:                              │
│ • "Charged twice, no gems received"   │
│ • "Error 503 on checkout"              │
│ • "Payment stuck on loading..."        │
└────────────────────────────────────────┘
```

---

### 4. Agent Scorecard Row (Support Ops)

```
┌──────────────────────────────────────────────────────────────┐
│ Agent          Workload  FRT     TTR     CSAT    FCR   Reopen│
│ ──────────────────────────────────────────────────────────── │
│ Sarah Chen       42 (3x)  8m/15m  2.1h/4h  4.8/5  89%   3%  │
│ Mike Johnson     38 (3x)  12m/22m 3.2h/6h  4.6/5  82%   8%  │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Chart Type Selection

| Data Type | Chart Type | Use Case |
|-----------|-----------|----------|
| Time series | Line chart | Revenue, DAU, rating over time |
| Comparison | Bar chart | Platform comparison, version comparison |
| Part-to-whole | Donut chart | Error distribution, platform share |
| Funnel | Funnel chart | Purchase funnel, FTUE funnel |
| Distribution | Histogram | Response time distribution |
| Multi-metric timeline | Multi-line | Triage timeline (4 metrics) |

---

## Interactivity Patterns

### Drill-down Flow
1. **Essential State card (red)** → Click
2. **Detailed metric view** → See breakdown by platform/version/region
3. **Affected users list** → Export or create JIRA ticket

### Filters
- Date range selector (default: 24h, options: 1h/6h/24h/7d/30d)
- Platform filter (iOS/Android/Steam/PC)
- Version filter (current/all)
- Region filter (all/top 10/custom)
- Segment filter (new users/returning/payers/free)

### Export Options
- PNG screenshot
- CSV data export
- JSON API response
- Link to share (with filters)

---

## Two Quick Decision Scenarios

### Scenario 1: "Payments Down"

1. Essential state "Payments" → 🔴 Red: payment success rate dropped
2. Timeline shows marker: release/remote-config/provider incident
3. VoC radar: spike in "payment failed" tickets + reviews "charged/error"
4. Action board: incident → owner → playbook (disable offer, rollback rule, escalate to provider)

**Dashboard guides user to decision in <3 minutes**

---

### Scenario 2: "Negative Spike After Patch"

1. Stability → crash-free sessions dropping
2. Store reputation: recent score falling (Steam last 30 days)
3. Release monitoring/markers: coincides with latest build
4. Decision: stop rollout / rollback / hotfix

**Dashboard reveals cause-effect in <5 minutes**

---

## Refresh Strategy

- **Real-time metrics** (WebSocket): Essential States, Queue Health
- **1-minute refresh**: Timeline, VoC radar
- **5-minute refresh**: Charts, trends
- **Hourly refresh**: Agent scorecards, historical data
- **Daily refresh**: Baselines, benchmarks

---

## Mobile Responsiveness

- **Desktop (>1280px):** Full 3-column layout
- **Tablet (768-1280px):** 2-column, scrollable
- **Mobile (<768px):** Single column, Essential States as cards

Priority on mobile:
1. Essential States (traffic lights)
2. VoC top issues
3. Action board
4. Everything else collapsed
