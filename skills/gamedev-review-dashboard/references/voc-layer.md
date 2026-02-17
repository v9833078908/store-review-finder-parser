# VoC Layer: Unifying Stores + Community + Support

## Unified Feedback Item Structure

Each review/post/ticket becomes a record:

```typescript
interface FeedbackItem {
  source: 'Store' | 'Community' | 'Support';
  timestamp: Date;
  platform: 'iOS' | 'Android' | 'Steam' | 'PC' | 'Console';
  region: string;
  language: string;
  app_version: string;
  build: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  topic_tags: string[];
  severity: 'P0' | 'P1' | 'P2';
  cluster_id?: string;
  text: string;
  rating?: number;
}
```

---

## Minimal Topic Dictionary (10-12 Themes)

Map to owners for accountability:

1. **Payments / Billing** → Monetization team
2. **Crashes / Performance / Lag** → Client engineers
3. **Login / Account / Bans** → Backend/Auth team
4. **Progression / FTUE** → Game design
5. **Economy / Balance** → Economy design
6. **Ads** (if applicable) → Monetization
7. **Content / LiveOps Events** → Content/LiveOps
8. **UI/UX** → UI/UX team
9. **Localization** → Localization team
10. **Cheaters/Abuse** → Anti-cheat/Moderation
11. **How to / Questions** → Support/Community
12. **Other** → Triage

---

## Issue Cluster (What You Actually Manage)

Cluster = grouping of similar messages from different sources

```typescript
interface IssueCluster {
  id: string;
  title: string;
  topics: string[];
  volume_24h: number;
  volume_7d: number;
  trend: 'rising' | 'stable' | 'falling';
  affected_segments: {
    versions?: string[];
    platforms?: string[];
    regions?: string[];
  };
  examples: FeedbackItem[]; // 3-5 representative quotes
  jira_link?: string;
  status: 'New' | 'Investigating' | 'Fixed' | 'Monitoring';
  owner?: string;
  created_at: Date;
  severity: 'P0' | 'P1' | 'P2';
}
```

**Why This Matters:**
Stop arguing "how important is this" and start seeing: *"This problem is growing, affecting iOS 1.2.3, coincided with release, already hitting stores"*.

---

## Clustering Strategy

**Auto-clustering:**
- Semantic similarity (embeddings + cosine similarity >0.82)
- Time window: 7 days
- Min cluster size: 5 items

**Manual override:**
- Product team can merge/split clusters
- Link to JIRA tickets
- Mark as duplicate

---

## VoC Dashboard Section

```
┌──────────────────────────────────────────────────────┐
│ UNIFIED VOC RADAR                                    │
├──────────────────────────────────────────────────────┤
│ Sentiment Trend (7d): ⬇ 72% → 68% (-4pp)            │
│ Feedback Volume: ↑ 1,234 (+18% vs 7d avg)           │
├──────────────────────────────────────────────────────┤
│ TOP EMERGING ISSUES (sorted by 24h growth):         │
│                                                      │
│ 🔴 P0: Payment errors on iOS 1.2.3                  │
│    Sources: 45 reviews + 89 tickets + 12 Discord    │
│    Spike: +340% vs baseline | Owner: @monetization  │
│    Examples: "charged twice", "error 503"...        │
│                                                      │
│ 🟡 P1: Lag in multiplayer after patch               │
│    Sources: 23 reviews + 67 tickets + 34 Discord    │
│    Spike: +120% vs baseline | Owner: @backend       │
│                                                      │
│ 🟢 P2: Request for dark mode                        │
│    Sources: 12 reviews + 5 tickets + 89 Discord     │
│    Trend: stable | Owner: @ui                       │
└──────────────────────────────────────────────────────┘
```

---

## Data Sources Integration

**Apple App Store:**
- App Store Connect API for reviews
- Filter by version, rating, language
- Response tracking

**Google Play:**
- Google Play Developer API
- Review reply tracking
- Rating distribution by version

**Steam:**
- Steam Web API (reviews endpoint)
- Recent vs lifetime score separation
- Language filtering

**Community (Discord/Reddit):**
- Discord webhook + sentiment analysis
- Reddit API (r/YourGame)
- Manual tagging by community managers

**Support (Zendesk/Intercom):**
- Ticket export API
- Tag mapping to VoC topics
- CSAT correlation
