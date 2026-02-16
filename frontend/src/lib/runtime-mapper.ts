import type { ApiAlert, ApiClassification, ApiReview, RunArtifact } from "@/lib/api-types"
import type { DashboardData } from "@/lib/dashboard-types"
import type {
  ActionItem,
  Alert,
  AlertSeverity,
  AlertType,
  Cluster,
  Review,
  ReviewCategory,
  Sentiment,
  Severity,
  TimelinePoint,
} from "@/lib/types"

const CRITICAL_SUBCATEGORIES = new Set(["crash", "progression_loss", "login_auth"])

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function categoryFromApi(value: string | undefined): ReviewCategory {
  switch ((value || "").toLowerCase()) {
    case "new_bug":
      return "bug"
    case "known_issue":
      return "complaint"
    case "feature_request":
      return "feature"
    case "praise":
      return "praise"
    case "noise":
      return "noise"
    default:
      return "complaint"
  }
}

function sentimentFromCategory(category: ReviewCategory): Sentiment {
  if (category === "praise") return "positive"
  if (category === "feature") return "mixed"
  if (category === "noise") return "neutral"
  return "negative"
}

function severityFromClassification(category: ReviewCategory, subcategory: string): Severity {
  const sub = subcategory.toLowerCase()
  if (CRITICAL_SUBCATEGORIES.has(sub)) return 5
  if (category === "bug") return 4
  if (category === "complaint") return 3
  if (category === "feature") return 2
  return 1
}

function alertTypeFromApi(alert: ApiAlert): AlertType {
  if (alert.type === "spike") return "spike"
  return "new_cluster"
}

function alertSeverityFromApi(alert: ApiAlert): AlertSeverity {
  if (alert.type === "critical_subcategory") return "critical"
  if (alert.type === "spike") return "high"
  if (alert.type === "new_issue_cluster") return "medium"
  return "low"
}

function actionTypeFromSeverity(severity: AlertSeverity): ActionItem["type"] {
  if (severity === "critical" || severity === "high") return "hotfix"
  return "investigation"
}

function avg(numbers: number[]): number {
  if (!numbers.length) return 0
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

function topValues(values: string[], limit = 3): string[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) continue
    counts.set(normalized, (counts.get(normalized) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value)
}

function recommendedAction(subcategory: string): string {
  const sub = subcategory.toLowerCase()
  if (CRITICAL_SUBCATEGORIES.has(sub)) {
    return "Immediate hotfix recommended. Reproduce, patch, and monitor crash/login rates for 72h."
  }
  if (sub.includes("ads") || sub.includes("monet")) {
    return "Audit monetization pressure and ad frequency. Validate player trust and retention impact."
  }
  if (sub.includes("match") || sub.includes("balance")) {
    return "Review matchmaking and progression curve. Validate fairness across player tiers."
  }
  if (sub.includes("performance") || sub.includes("server") || sub.includes("connection")) {
    return "Profile performance and stability regressions by version/device. Prioritize reliability fixes."
  }
  return "Investigate root cause, prioritize by impact, and track post-fix review trend."
}

function buildReviews(artifact: RunArtifact): Review[] {
  const rawReviews = artifact.reviews || []
  const country = String(artifact.country || "us").toUpperCase()
  const defaultVersion = artifact.current_version?.version || "unknown"
  const classifications = new Map<string, ApiClassification>(
    (artifact.classified || []).map((entry) => [String(entry.review_id || ""), entry]),
  )

  return rawReviews.map((item: ApiReview, index) => {
    const classification = classifications.get(String(item.review_id || ""))
    const category = categoryFromApi(classification?.category)
    const subcategory = String(classification?.subcategory || "general").trim().toLowerCase() || "general"
    return {
      id: String(item.review_id || `review-${index}`),
      productId: slugify(artifact.package_name || artifact.app_name || "app"),
      rating: Number(item.rating || 0),
      text: String(item.text || ""),
      lang: String(item.lang || (artifact.langs && artifact.langs[0]) || "en"),
      country,
      appVersion: String(item.version || defaultVersion),
      category,
      subcategory,
      sentiment: sentimentFromCategory(category),
      themes: [subcategory],
      severity: severityFromClassification(category, subcategory),
      hasReply: false,
      createdAt: String(item.date || artifact.saved_at || new Date().toISOString()),
    }
  })
}

function buildClusters(reviews: Review[]): { clusters: Cluster[]; clusterBySubcategory: Map<string, string> } {
  const groups = new Map<string, Review[]>()
  for (const review of reviews) {
    if (review.category !== "bug" && review.category !== "complaint") continue
    const key = review.subcategory || "general"
    const list = groups.get(key) || []
    list.push(review)
    groups.set(key, list)
  }

  const dates = reviews
    .map((review) => toDate(review.createdAt))
    .filter((value): value is Date => value !== null)
  const latest = dates.length ? new Date(Math.max(...dates.map((value) => value.getTime()))) : new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const sevenDaysAgo = new Date(latest.getTime() - 7 * dayMs)
  const fourteenDaysAgo = new Date(latest.getTime() - 14 * dayMs)

  const clusterBySubcategory = new Map<string, string>()
  const clusters: Cluster[] = []

  for (const [subcategory, items] of groups.entries()) {
    const id = `cl-${slugify(subcategory || "general")}`
    clusterBySubcategory.set(subcategory, id)

    const itemDates = items
      .map((review) => toDate(review.createdAt))
      .filter((value): value is Date => value !== null)
    const firstSeen = itemDates.length ? new Date(Math.min(...itemDates.map((value) => value.getTime()))) : latest
    const lastSeen = itemDates.length ? new Date(Math.max(...itemDates.map((value) => value.getTime()))) : latest
    const volume24h = items.filter((review) => {
      const dt = toDate(review.createdAt)
      return dt !== null && dt.getTime() >= latest.getTime() - dayMs
    }).length
    const volume7d = items.filter((review) => {
      const dt = toDate(review.createdAt)
      return dt !== null && dt >= sevenDaysAgo
    }).length
    const previous7d = items.filter((review) => {
      const dt = toDate(review.createdAt)
      return dt !== null && dt < sevenDaysAgo && dt >= fourteenDaysAgo
    }).length
    const trend =
      previous7d === 0
        ? volume7d > 0
          ? 100
          : 0
        : Math.round(((volume7d - previous7d) / previous7d) * 100)

    clusters.push({
      id,
      title: titleCase(subcategory),
      summary: `${items.length} reports grouped under "${subcategory}".`,
      severity: Math.round(avg(items.map((review) => review.severity))) as Severity,
      volume24h,
      volume7d,
      trend,
      ratingAvg: Number(avg(items.map((review) => review.rating)).toFixed(2)),
      topLangs: topValues(items.map((review) => review.lang)),
      topCountries: topValues(items.map((review) => review.country)),
      topVersions: topValues(items.map((review) => review.appVersion)),
      firstSeen: firstSeen.toISOString(),
      lastSeen: lastSeen.toISOString(),
      status: volume24h > 0 ? "active" : "monitoring",
      reviewIds: items.map((review) => review.id),
      recommendedAction: recommendedAction(subcategory),
    })
  }

  clusters.sort((left, right) => {
    if (left.severity !== right.severity) return right.severity - left.severity
    return right.volume7d - left.volume7d
  })

  return { clusters, clusterBySubcategory }
}

function buildAlerts(
  artifact: RunArtifact,
  clusterBySubcategory: Map<string, string>,
): Alert[] {
  const fallbackDate = artifact.saved_at || artifact.fetched_at || new Date().toISOString()
  const alerts = (artifact.alerts || []).map((alert, index) => {
    const subcategory = String(alert.subcategory || "general")
    const id = `al-${index + 1}`
    const type = alertTypeFromApi(alert)
    const severity = alertSeverityFromApi(alert)
    const clusterId = clusterBySubcategory.get(subcategory)
    const title =
      alert.type === "spike"
        ? `${titleCase(subcategory)} spike detected`
        : `${titleCase(subcategory)} issue detected`
    const description =
      alert.type === "spike"
        ? `${alert.count} reports in current window vs baseline ${Number(alert.baseline || 0).toFixed(2)}.`
        : `${alert.count} reports classified as ${alert.type} in "${subcategory}".`

    return {
      id,
      type,
      severity,
      title,
      description,
      metric: `${alert.type}:${subcategory}`,
      baseline: Number(alert.baseline || 0),
      current: Number(alert.count || 0),
      clusterId,
      detectedAt: fallbackDate,
      status: "active",
    } satisfies Alert
  })

  alerts.sort((left, right) => {
    const severityRank: Record<AlertSeverity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    }
    return severityRank[right.severity] - severityRank[left.severity]
  })

  return alerts
}

function buildTimeline(
  reviews: Review[],
  alerts: Alert[],
  releaseVersion: string | undefined,
  releaseDateRaw: string | undefined,
): TimelinePoint[] {
  const dateValues = reviews
    .map((review) => toDate(review.createdAt))
    .filter((value): value is Date => value !== null)
  const latest = dateValues.length ? new Date(Math.max(...dateValues.map((value) => value.getTime()))) : new Date()
  const releaseDate = toDate(releaseDateRaw)
  const dayMs = 24 * 60 * 60 * 1000

  const points: TimelinePoint[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(latest.getTime() - offset * dayMs)
    const key = isoDateOnly(day)
    const dayReviews = reviews.filter((review) => isoDateOnly(new Date(review.createdAt)) === key)
    const dayAlerts = alerts.filter((alert) => {
      const dt = toDate(alert.detectedAt)
      return dt !== null && isoDateOnly(dt) === key
    })
    points.push({
      date: key,
      negativeReviews: dayReviews.filter((review) => review.sentiment === "negative").length,
      bugReports: dayReviews.filter((review) => review.category === "bug").length,
      alerts: dayAlerts.length,
      totalReviews: dayReviews.length,
      releaseVersion:
        releaseVersion && releaseDate && isoDateOnly(releaseDate) === key ? releaseVersion : undefined,
    })
  }

  return points
}

function buildActionItems(alerts: Alert[], clusters: Cluster[]): ActionItem[] {
  const now = Date.now()
  const sources = alerts.length ? alerts : []
  if (!sources.length && clusters.length) {
    return clusters.slice(0, 3).map((cluster, index) => ({
      id: `act-${index + 1}`,
      type: "investigation",
      title: `Investigate ${cluster.title}`,
      owner: "TBD",
      status: "pending",
      relatedClusterId: cluster.id,
      nextCheckAt: new Date(now + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      notes: cluster.recommendedAction,
    }))
  }

  return sources.slice(0, 5).map((alert, index) => ({
    id: `act-${index + 1}`,
    type: actionTypeFromSeverity(alert.severity),
    title: alert.title,
    owner: "TBD",
    status: index === 0 ? "in_progress" : "pending",
    relatedClusterId: alert.clusterId || clusters[0]?.id || "",
    nextCheckAt: new Date(now + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    notes: alert.description,
  }))
}

function buildIssueAndReputationStats(
  reviews: Review[],
  clusters: Cluster[],
  alerts: Alert[],
  avgRating: number,
): {
  issueStats: DashboardData["issueStats"]
  reputationStats: DashboardData["reputationStats"]
} {
  const dateValues = reviews
    .map((review) => toDate(review.createdAt))
    .filter((value): value is Date => value !== null)
  const latest = dateValues.length ? new Date(Math.max(...dateValues.map((value) => value.getTime()))) : new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const sevenDaysAgo = new Date(latest.getTime() - 7 * dayMs)
  const fourteenDaysAgo = new Date(latest.getTime() - 14 * dayMs)

  const currentPeriod = reviews.filter((review) => {
    const dt = toDate(review.createdAt)
    return dt !== null && dt >= sevenDaysAgo
  })
  const previousPeriod = reviews.filter((review) => {
    const dt = toDate(review.createdAt)
    return dt !== null && dt < sevenDaysAgo && dt >= fourteenDaysAgo
  })

  const currentLowShare =
    currentPeriod.length === 0
      ? 0
      : currentPeriod.filter((review) => review.rating <= 2).length / currentPeriod.length
  const previousLowShare =
    previousPeriod.length === 0
      ? 0
      : previousPeriod.filter((review) => review.rating <= 2).length / previousPeriod.length

  const currentAvg = currentPeriod.length ? avg(currentPeriod.map((review) => review.rating)) : avgRating
  const previousAvg = previousPeriod.length ? avg(previousPeriod.map((review) => review.rating)) : currentAvg

  return {
    issueStats: {
      newClusters: clusters.filter((cluster) => {
        const firstSeen = toDate(cluster.firstSeen)
        return firstSeen !== null && firstSeen >= sevenDaysAgo
      }).length,
      spikeCount: alerts.filter((alert) => alert.type === "spike").length,
      criticalCount: alerts.filter((alert) => alert.severity === "critical").length,
    },
    reputationStats: {
      currentRating: Number(avgRating.toFixed(2)),
      ratingTrend: Number((currentAvg - previousAvg).toFixed(2)),
      lowRatingShare: Number(currentLowShare.toFixed(2)),
      lowRatingShareChange: Number((currentLowShare - previousLowShare).toFixed(2)),
    },
  }
}

export function mapRunArtifactToDashboard(artifact: RunArtifact): DashboardData {
  const reviews = buildReviews(artifact).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
  const { clusters, clusterBySubcategory } = buildClusters(reviews)
  const alerts = buildAlerts(artifact, clusterBySubcategory)
  const avgRating = Number(
    artifact.stats?.avg_rating ??
      artifact.app_metadata?.score ??
      avg(reviews.map((review) => review.rating)) ??
      0,
  )

  const { issueStats, reputationStats } = buildIssueAndReputationStats(reviews, clusters, alerts, avgRating)
  const actionItems = buildActionItems(alerts, clusters)
  const timelineData = buildTimeline(
    reviews,
    alerts,
    artifact.current_version?.version,
    artifact.current_version?.first_seen,
  )

  const totalReviews =
    Number(artifact.app_metadata?.ratings || 0) ||
    Number(artifact.stats?.reviews_analyzed || 0) ||
    reviews.length

  return {
    runId: artifact.run_id || null,
    appName: artifact.app_name || artifact.package_name || "Unknown app",
    packageName: artifact.package_name || "",
    product: {
      id: slugify(artifact.package_name || artifact.app_name || "app"),
      name: artifact.app_name || artifact.package_name || "Unknown app",
      packageId: artifact.package_name || "unknown.package",
      platform: "google_play",
      rating: Number(avgRating.toFixed(2)),
      totalReviews,
    },
    reputationStats,
    issueStats,
    responseStats: {
      unansweredPercent: 0,
      unansweredNegatives: 0,
      totalUnanswered: 0,
    },
    timelineData,
    reviews,
    clusters,
    alerts,
    actionItems,
    markdown: artifact.synthesis_markdown || artifact.markdown || "",
    lastUpdated: artifact.saved_at || artifact.fetched_at || new Date().toISOString(),
    source: "api",
  }
}
