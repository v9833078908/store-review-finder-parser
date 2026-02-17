# Essential States: 7 Core Dashboard Cards

Each card shows: **color + 1-2 key numbers + delta vs baseline + "since when" + owner**

## 1. Payments (Monetization / Checkout)

**Metrics:**
- Payment success rate (15m / 1h / 24h)
- Purchase funnel drop (start checkout → success)
- Errors by provider / 3DS / blocks (share)

**Why:** Payment success degradation = immediate revenue loss and trust damage. Measure "success of all payment attempts" (including 3DS and blocks), not just "created payments".

**States:**
- 🟢 Green: normal vs baseline
- 🟡 Yellow: noticeable drift down / error growth
- 🔴 Red: sharp drop or systemic provider error

**Event markers:**
- Payment SDK change / build update
- New payment method / 3DS rule enabled
- Provider incident / Stripe/Radar rule change

---

## 2. Revenue (What We're Earning Now)

**Metrics:**
- Revenue (gross/net), 1h/24h, **delta vs expected**
- ARPDAU (Revenue / DAU)
- Paying users (payers), payer conversion

**Why:** Revenue is a lagging signal, but combined with Payments/Crash/VoC it answers: "Is this noise or are we actually making less money?"

**Events:** Event start/end, new store, pricing changes, UA campaign

---

## 3. Stability (Client Quality / Crashes)

**Metrics:**
- **Crash-free sessions** (and crash-free users separately)
- Top new crashes / new signatures after release
- Crash share by version/device/OS

**Why:** Crash-free sessions is the clear, actionable stability indicator: **% of sessions that didn't end in a crash**.

Critical to have version breakdown to quickly decide: rollback or hotfix.

**Events:** Build release / remote-config feature toggle

**Practice:** Monitor latest release separately - allows comparing current build metrics with previous ones for fast stop/rollback decision.

---

## 4. Backend/API (Services: Login, Matchmaking, Inventory, Economy)

**Metrics:**
- Availability / error rate (5xx, timeouts)
- Latency p95/p99 (for key APIs)
- Login success rate / matchmaking success rate (if relevant)

**Why:** Players rarely write "your p95 is up" - they write "can't login", "lags", "can't buy". This block translates **user pain into engineering signal**.

**Events:** Backend deploy, migrations, cloud/provider incidents

---

## 5. Store Reputation (Store Rankings)

**Metrics:**
- Rating (rolling 7d) + review inflow rate
- Share of 1-2★, "recent" vs "lifetime" where applicable
- Negative review themes (top-3)

**Why:** Directly impacts store → install/purchase conversion and game trust.

Steam has two review scores (last 30 days and lifetime) - important to keep side-by-side because "recent" first shows degradation after patch/event.

App Store rating/reviews can change for new version (tools in App Store Connect).

**Events:** Version release, major event, sharp balance/monetization changes

---

## 6. Support (Load and SLA Risk) - "Not a Black Hole"

**Metrics:**
- Ticket inflow (1h/24h), solved (1h/24h)
- Backlog + Aging (how many tickets "older than N hours")
- **First reply time** (median) and % tickets "at SLA risk"

**Why:** When support "drowns", players start to:
1. Leave silently (retention drops)
2. Write to stores (reputation drops)
3. Demand refunds (revenue drops)

First reply time is the base actionable indicator of response speed.

---

## 7. VoC (Voice of Customer) - "What's Hurting Players" in One Place

**Metrics:**
- Unified negative feedback volume (reviews + community + tickets)
- Sentiment index (rolling)
- "Top emerging issues" (top-5 themes with growth)

**Why:** This is your **pain radar** and main source of hypotheses. Critical that it's "unified" - otherwise store reviews live separately, Discord separately, support separately, and you lose cause-and-effect connections.

---

## Color Coding Standards

- 🟢 **Green (#22c55e)**: Within baseline ±10%
- 🟡 **Yellow (#f59e0b)**: 10-30% degradation or sustained drift
- 🔴 **Red (#ef4444)**: >30% degradation or critical threshold breach
