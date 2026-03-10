import type { DashboardData } from "@/lib/dashboard-types"
import type { Alert, Cluster, FeedbackSource, Review, TimelinePoint } from "@/lib/types"
import { buildDerivedReportLayers } from "@/lib/runtime-mapper"
import { buildCommunityPulseFromReviews, buildCommunityThreadsFromReviews, buildSourceComparison } from "@/lib/community-mapper"
import {
  isDateInRange,
  isMoscowDateKeyInRange,
  type ResolvedDateRange,
} from "@/lib/date-filters"

function safeDate(value: string): Date | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
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

function computeTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - previous) / previous) * 100)
}

function inRange(review: Review, range: ResolvedDateRange): boolean {
  return isDateInRange(review.createdAt, range)
}

function inPreviousRange(review: Review, range: ResolvedDateRange): boolean {
  const dt = safeDate(review.createdAt)
  if (!dt) return false

  const rangeDurationMs = range.to.getTime() - range.from.getTime()
  const previousFrom = new Date(range.from.getTime() - rangeDurationMs - 1)
  const previousTo = new Date(range.from.getTime() - 1)

  return dt >= previousFrom && dt <= previousTo
}

function deriveCluster(
  cluster: Cluster,
  allClusterReviews: Review[],
  filteredClusterReviews: Review[],
  range: ResolvedDateRange,
): Cluster {
  const sortedDates = filteredClusterReviews
    .map((review) => safeDate(review.createdAt))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  const rangeEndMs = range.to.getTime()
  const twentyFourHoursAgo = rangeEndMs - 24 * 60 * 60 * 1000

  const volume24h = filteredClusterReviews.filter((review) => {
    const dt = safeDate(review.createdAt)
    return dt !== null && dt.getTime() >= twentyFourHoursAgo && dt.getTime() <= rangeEndMs
  }).length

  const currentCount = filteredClusterReviews.length
  const previousCount = allClusterReviews.filter((review) => inPreviousRange(review, range)).length

  return {
    ...cluster,
    volume24h,
    volume7d: currentCount,
    trend: computeTrend(currentCount, previousCount),
    ratingAvg: Number(average(filteredClusterReviews.map((review) => review.rating)).toFixed(2)),
    topLangs: topValues(filteredClusterReviews.map((review) => review.lang)),
    topCountries: topValues(filteredClusterReviews.map((review) => review.country)),
    topVersions: topValues(filteredClusterReviews.map((review) => review.appVersion)),
    firstSeen: sortedDates[0]?.toISOString() || cluster.firstSeen,
    lastSeen: sortedDates[sortedDates.length - 1]?.toISOString() || cluster.lastSeen,
    reviewIds: filteredClusterReviews.map((review) => review.id),
    status: volume24h > 0 ? "active" : "monitoring",
  }
}

function deriveReputationStats(allReviews: Review[], filteredReviews: Review[], range: ResolvedDateRange) {
  const currentAvg = average(filteredReviews.map((review) => review.rating))
  const currentLowShare = filteredReviews.length
    ? filteredReviews.filter((review) => review.rating <= 2).length / filteredReviews.length
    : 0

  const previousReviews = allReviews.filter((review) => inPreviousRange(review, range))
  const previousAvg = previousReviews.length ? average(previousReviews.map((review) => review.rating)) : currentAvg
  const previousLowShare = previousReviews.length
    ? previousReviews.filter((review) => review.rating <= 2).length / previousReviews.length
    : currentLowShare

  return {
    currentRating: Number(currentAvg.toFixed(2)),
    ratingTrend: Number((currentAvg - previousAvg).toFixed(2)),
    lowRatingShare: Number(currentLowShare.toFixed(4)),
    lowRatingShareChange: Number((currentLowShare - previousLowShare).toFixed(4)),
  }
}

function deriveResponseStats(filteredReviews: Review[]) {
  const unanswered = filteredReviews.filter((review) => !review.hasReply)
  const unansweredNegatives = unanswered.filter((review) => review.sentiment === "negative")

  return {
    unansweredPercent: filteredReviews.length
      ? Math.round((unanswered.length / filteredReviews.length) * 100)
      : 0,
    unansweredNegatives: unansweredNegatives.length,
    totalUnanswered: unanswered.length,
  }
}

function deriveIssueStats(clusters: Cluster[], alerts: Alert[]) {
  return {
    newClusters: clusters.length,
    spikeCount: alerts.filter((alert) => alert.type === "spike").length,
    criticalCount: alerts.filter((alert) => alert.severity === "critical").length,
  }
}

function buildTimelineFromReviews(reviews: Review[], alerts: Alert[]): TimelinePoint[] {
  const parsedDates = reviews
    .map((review) => safeDate(review.createdAt))
    .filter((value): value is Date => value !== null)
  const latest = parsedDates.length
    ? new Date(Math.max(...parsedDates.map((value) => value.getTime())))
    : new Date()
  const dayMs = 24 * 60 * 60 * 1000

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(latest.getTime() - (6 - index) * dayMs)
    const key = day.toISOString().slice(0, 10)
    const dayReviews = reviews.filter((review) => review.createdAt.slice(0, 10) === key)
    const dayAlerts = alerts.filter((alert) => alert.detectedAt.slice(0, 10) === key)

    return {
      date: key,
      negativeReviews: dayReviews.filter((review) => review.sentiment === "negative").length,
      bugReports: dayReviews.filter((review) => review.category === "bug").length,
      alerts: dayAlerts.length,
      totalReviews: dayReviews.length,
    }
  })
}

export function filterDashboardDataByDate(
  data: DashboardData,
  range: ResolvedDateRange,
  source: FeedbackSource | null = null,
): DashboardData {
  const sourceScopedReviews = source ? data.reviews.filter((review) => review.source === source) : data.reviews

  const filteredReviews = sourceScopedReviews
    .filter((review) => inRange(review, range))
    .sort((left, right) => {
      const rightTime = safeDate(right.createdAt)?.getTime() ?? 0
      const leftTime = safeDate(left.createdAt)?.getTime() ?? 0
      return rightTime - leftTime
    })
  const filteredReviewIds = new Set(filteredReviews.map((review) => review.id))
  const reviewById = new Map(sourceScopedReviews.map((review) => [review.id, review]))

  const filteredClusters = data.clusters
    .map((cluster) => {
      const allClusterReviews = cluster.reviewIds
        .map((id) => reviewById.get(id))
        .filter((value): value is Review => value !== undefined)

      const filteredClusterReviews = allClusterReviews.filter((review) => filteredReviewIds.has(review.id))
      if (!filteredClusterReviews.length) return null

      return deriveCluster(cluster, allClusterReviews, filteredClusterReviews, range)
    })
    .filter((value): value is Cluster => value !== null)
    .sort((left, right) => {
      if (left.severity !== right.severity) return right.severity - left.severity
      return right.volume7d - left.volume7d
    })

  const scopedAlerts = source === "community" ? [] : data.alerts
  const filteredAlerts = scopedAlerts.filter((alert) => isDateInRange(alert.detectedAt, range))
  const activeClusterIds = new Set(filteredClusters.map((cluster) => cluster.id))

  const filteredActions = data.actionItems.filter(
    (action) => !action.relatedClusterId || activeClusterIds.has(action.relatedClusterId),
  )

  const filteredTimeline = source
    ? buildTimelineFromReviews(filteredReviews, filteredAlerts)
    : data.timelineData.filter((point) => isMoscowDateKeyInRange(point.date, range))

  const reputationStats = deriveReputationStats(sourceScopedReviews, filteredReviews, range)
  const responseStats = deriveResponseStats(filteredReviews)
  const issueStats = deriveIssueStats(filteredClusters, filteredAlerts)
  const reportLayers = buildDerivedReportLayers(
    filteredReviews,
    filteredAlerts,
    filteredClusters,
    filteredActions,
  )
  const filteredGooglePlayReviews = filteredReviews.filter((review) => review.source === "google_play")
  const filteredCommunityReviews = filteredReviews.filter((review) => review.source === "community")
  const communityPulse =
    data.communityDataLoaded && source !== "google_play"
      ? buildCommunityPulseFromReviews(
        filteredCommunityReviews,
        source === null
          ? Math.max(filteredCommunityReviews.length, data.communityPulse?.totalMessages || 0)
          : filteredCommunityReviews.length,
      )
      : undefined
  const communityThreads =
    data.communityDataLoaded && source !== "google_play"
      ? buildCommunityThreadsFromReviews(filteredCommunityReviews)
      : []
  const sourceComparison =
    data.communityDataLoaded && source === null
      ? buildSourceComparison(filteredGooglePlayReviews, filteredCommunityReviews)
      : undefined

  return {
    ...data,
    product: {
      ...data.product,
      rating: reputationStats.currentRating,
      totalReviews: filteredReviews.length,
    },
    reputationStats,
    responseStats,
    issueStats,
    timelineData: filteredTimeline,
    reviews: filteredReviews,
    clusters: filteredClusters,
    alerts: filteredAlerts,
    actionItems: filteredActions,
    reportLayers,
    communityPulse,
    communityThreads,
    sourceComparison,
  }
}
