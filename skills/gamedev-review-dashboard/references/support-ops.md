# Support Ops: Making Support Work Transparent and Fair

**Core Principle:** Don't create a "ticket closing race" - give support lead and producer transparency on: load, response speed, solution quality, product impact, fair work distribution.

---

## Support Ops Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ FILTERS: period | channel (email/chat) | lang | platform | topic │
├─────────────────────────────────────────────────────────────────┤
│ QUEUE HEALTH: Inflow vs Solved | Backlog | Aging | SLA-at-risk  │
├────────────────────────┬────────────────────────┬───────────────┤
│ QUALITY (outcomes)     │ EFFICIENCY (flow)      │ ESCALATIONS   │
│ CSAT | FCR | Reopen    │ First Reply | Time to  │ to Dev/QA     │
│ Refund-related tickets │ Close | Reassignments  │ to Billing    │
├─────────────────────────────────────────────────────────────────┤
│ AGENT SCORECARDS (clickable):                                   │
│ Agent | Workload | FRT p50/p90 | TTR p50/p90 | CSAT | FCR |... │
├─────────────────────────────────────────────────────────────────┤
│ COACHING & RISKS: outliers | missing tags | overdue | QA notes  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Transparency Metrics by Agent

### A) Workload (Weighted Load, Not Just "How Many Closed")

**What to measure:**
- Tickets solved (weighted by category complexity)
- WIP (concurrent tickets "on agent")

**Why:** Otherwise agent handling "complex payments" looks worse than agent closing "how to change language".

**Weights example:**
- Billing/Refunds: 3x
- Technical issues: 2x
- Gameplay questions: 1.5x
- How-to: 1x

---

### B) First Reply Time (FRT) - Response Speed

**What to measure:**
- Median FRT and p90 FRT by agent
- % tickets where FRT exceeded SLA

**Why:** FRT is key to "they hear me" feeling. Show transparently (Zendesk/similar systems can report this).

**Critical:** *median + p90*, so one "complex case" doesn't break the evaluation.

---

### C) Time to Close / Resolution (TTR) - Speed to Result

**What to measure:**
- Median TTR and p90
- Breakdown: "in agent work" vs "waiting for player" (if possible)

**Why:** Reveals bottlenecks. Important **not to blame agent for player wait time** - split time components.

---

### D) First Contact Resolution (FCR) - Solution Quality

**What to measure:**
- % inquiries resolved on first contact
- Repeat contact rate (repeat inquiries on same topic)

**Why:** Main antidote to "replied fast - and dropped".

Intercom directly includes "resolved on first contact" and "reassignments/time to close" in team effectiveness - good reference for what to show.

---

### E) CSAT - Quality Through Player Eyes

**What to measure:**
- CSAT by agent (but show **with confidence interval/volume** to not "kill" newbies with small sample)
- CSAT by category (payments/bans/crashes)

**Why:** CSAT is your "trust thermometer".

Important to combine with FCR/Reopen, otherwise CSAT can be "begged for" without real solution.

---

### F) Reopen / Reassignments / Escalations - Process Signals

**What to measure:**
- Reopen rate (share of reopens)
- Reassignments/transfer rate (how often passed around)
- Escalation rate (to Dev/Billing)

**Why:** Shows where process breaks: lacking knowledge, wrong routing, no authority/tools.

---

### G) "Product Output" of Support (So It's Not Just "Fire Fighting Department")

**What to measure:**
- % tickets that became bug reports
- Median time to escalate → dev
- Median time to fix (if linked with JIRA)
- Deflection: how many questions went to FAQ/KB (if knowledge base exists)

**Why:** Transforms support from "black hole" into **product quality sensor** and priority source.

---

## Avoiding Toxic "Leaderboards"

To prevent metrics from destroying the team:

1. **On main screen - distributions and trends**, not public ranking
2. **"Tickets solved" only paired with FCR/CSAT/Reopen** (balance)
3. **Weight category complexity**
4. **Normalize on "on-shift time"** (who was on duty)
5. **For small CSAT samples, show cautiously**

---

## Agent Scorecard Interface

```typescript
interface AgentScorecard {
  agent_id: string;
  agent_name: string;
  period: DateRange;

  // Load
  tickets_solved: number;
  tickets_solved_weighted: number;
  wip_current: number;
  wip_avg: number;

  // Speed
  frt_median_minutes: number;
  frt_p90_minutes: number;
  frt_sla_breach_pct: number;
  ttr_median_hours: number;
  ttr_p90_hours: number;

  // Quality
  csat_score: number;
  csat_sample_size: number;
  fcr_rate: number;
  reopen_rate: number;

  // Process
  reassignment_rate: number;
  escalation_rate: number;
  escalations_to_dev: number;
  escalations_to_billing: number;

  // Product impact
  bug_reports_created: number;
  kb_articles_contributed: number;
}
```

---

## Queue Health Metrics

```typescript
interface QueueHealth {
  inflow_24h: number;
  solved_24h: number;
  backlog_current: number;
  backlog_trend: 'growing' | 'stable' | 'shrinking';

  aging: {
    under_4h: number;
    under_24h: number;
    over_24h: number;
    over_72h: number;
  };

  sla_at_risk: number;
  sla_at_risk_pct: number;

  channel_distribution: {
    email: number;
    chat: number;
    in_app: number;
  };
}
```
