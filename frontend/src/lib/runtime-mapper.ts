/**
 * runtime-mapper.ts — Maps raw RunArtifact API payloads to DashboardData.
 *
 * CATEGORY MAPPING CONTRACT
 * ─────────────────────────
 * The Python backend classifies reviews into 5 categories that are mapped
 * to frontend ReviewCategory values here:
 *
 *   API value          Frontend ReviewCategory   Notes
 *   ─────────────────  ───────────────────────   ─────────────────────────────
 *   "new_bug"          "bug"                      New bug, not previously known
 *   "known_issue"      "complaint"                Known problem / general complaint
 *   "feature_request"  "feature"                  Feature request
 *   "praise"           "praise"                   Positive review
 *   "noise"            "noise"                    Irrelevant / uninformative
 *   (anything else)    "complaint"                Fallback for unknown values
 *
 * See categoryFromApi() for the implementation.
 * Source: classifier.py valid_categories + pipeline.py category_counts.
 */
import type {
  ApiAlert,
  ApiClassification,
  ApiReportLayer,
  ApiReportLayers,
  ApiReview,
  RunArtifact,
} from "@/lib/api-types"
import type { DashboardData } from "@/lib/dashboard-types"
import { buildEmptyReportLayers, type ReportLayer, type ReportLayers } from "@/lib/dashboard-types"
import type { SupportedLocale } from "@/lib/i18n"
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
const RU_SUBCATEGORY_LABELS: Record<string, string> = {
  crash: "Краши",
  performance: "Проблемы производительности",
  ui: "Проблемы интерфейса",
  balance: "Баланс и прогрессия",
  monetization: "Монетизация",
  multiplayer: "Мультиплеер и соединение",
  progression_loss: "Потеря прогресса",
  login_auth: "Логин и авторизация",
  content: "Контент",
  gameplay: "Геймплей",
  social: "Социальные функции",
  customization: "Кастомизация",
  ui_improvement: "Улучшение интерфейса",
  other: "Прочее",
  general: "Общее",
}

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

function subcategoryLabel(subcategory: string, locale: SupportedLocale): string {
  const normalized = (subcategory || "general").trim().toLowerCase() || "general"
  if (locale === "ru") {
    return RU_SUBCATEGORY_LABELS[normalized] || normalized.replace(/[_-]+/g, " ")
  }
  return titleCase(normalized)
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

/**
 * Map a backend classification category string to a frontend ReviewCategory.
 *
 * Full mapping table (see module header for details):
 *   "new_bug"          → "bug"
 *   "known_issue"      → "complaint"
 *   "feature_request"  → "feature"
 *   "praise"           → "praise"
 *   "noise"            → "noise"
 *   (unknown / empty)  → "complaint"  (fallback)
 */
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

function recommendedAction(subcategory: string, locale: SupportedLocale): string {
  const sub = subcategory.toLowerCase()
  if (CRITICAL_SUBCATEGORIES.has(sub)) {
    if (locale === "ru") {
      return "Рекомендуется срочный хотфикс: воспроизвести, исправить и мониторить crash/login метрики 72 часа."
    }
    return "Immediate hotfix recommended. Reproduce, patch, and monitor crash/login rates for 72h."
  }
  if (sub.includes("ads") || sub.includes("monet")) {
    if (locale === "ru") {
      return "Проверить давление монетизации и частоту рекламы. Оценить влияние на доверие и удержание игроков."
    }
    return "Audit monetization pressure and ad frequency. Validate player trust and retention impact."
  }
  if (sub.includes("match") || sub.includes("balance")) {
    if (locale === "ru") {
      return "Перепроверить матчмейкинг и кривую прогрессии. Валидировать ощущение справедливости по сегментам игроков."
    }
    return "Review matchmaking and progression curve. Validate fairness across player tiers."
  }
  if (sub.includes("performance") || sub.includes("server") || sub.includes("connection")) {
    if (locale === "ru") {
      return "Профилировать регрессии производительности и стабильности по версиям/устройствам, с приоритетом надёжности."
    }
    return "Profile performance and stability regressions by version/device. Prioritize reliability fixes."
  }
  if (locale === "ru") {
    return "Исследовать корневую причину, приоритизировать по влиянию и отслеживать тренд после исправлений."
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
    const replyText = typeof item.reply_text === "string" ? item.reply_text.trim() : ""
    const hasReply = typeof item.has_reply === "boolean" ? item.has_reply : replyText.length > 0
    return {
      id: String(item.review_id || `review-${index}`),
      productId: slugify(artifact.package_name || artifact.app_name || "app"),
      rating: Number(item.rating || 0),
      text: String(item.text || ""),
      lang: String(item.original_lang || item.lang || (artifact.langs && artifact.langs[0]) || "en"),
      originalLang: String(item.original_lang || item.lang || (artifact.langs && artifact.langs[0]) || "en"),
      country,
      appVersion: String(item.version || defaultVersion),
      category,
      subcategory,
      sentiment: sentimentFromCategory(category),
      themes: [subcategory],
      severity: severityFromClassification(category, subcategory),
      hasReply,
      createdAt: String(item.date || artifact.saved_at || new Date().toISOString()),
    }
  })
}

function buildClusters(
  reviews: Review[],
  locale: SupportedLocale,
): { clusters: Cluster[]; clusterBySubcategory: Map<string, string> } {
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
      title: subcategoryLabel(subcategory, locale),
      summary:
        locale === "ru"
          ? `${items.length} отзывов объединены в кластер «${subcategoryLabel(subcategory, locale)}».`
          : `${items.length} reports grouped under "${subcategory}".`,
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
      recommendedAction: recommendedAction(subcategory, locale),
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
  locale: SupportedLocale,
): Alert[] {
  const fallbackDate = artifact.saved_at || artifact.fetched_at || new Date().toISOString()
  const alerts = (artifact.alerts || []).map((alert, index) => {
    const subcategory = String(alert.subcategory || "general")
    const id = `al-${index + 1}`
    const type = alertTypeFromApi(alert)
    const severity = alertSeverityFromApi(alert)
    const clusterId = clusterBySubcategory.get(subcategory)
    const title =
      locale === "ru"
        ? alert.type === "spike"
          ? `Всплеск: ${subcategoryLabel(subcategory, locale)}`
          : `Сигнал: ${subcategoryLabel(subcategory, locale)}`
        : alert.type === "spike"
          ? `${titleCase(subcategory)} spike detected`
          : `${titleCase(subcategory)} issue detected`
    const description =
      locale === "ru"
        ? alert.type === "spike"
          ? `${alert.count} упоминаний в текущем окне при базовом уровне ${Number(alert.baseline || 0).toFixed(2)}.`
          : `${alert.count} упоминаний в категории ${alert.type} для темы «${subcategoryLabel(subcategory, locale)}».`
        : alert.type === "spike"
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

function importanceFromCluster(cluster: Cluster): number {
  const base = Math.min(10, cluster.severity * 2)
  const volumeBoost = Math.min(2, Math.floor(cluster.volume7d / 10))
  return Math.min(10, Math.max(1, base + volumeBoost))
}

type UrgencyBucket = "immediate" | "short_term" | "monitor"

const URGENCY_IMPORTANCE: Record<UrgencyBucket, number> = {
  immediate: 9,
  short_term: 6,
  monitor: 3,
}

const URGENCY_TYPE: Record<UrgencyBucket, ActionItem["type"]> = {
  immediate: "hotfix",
  short_term: "investigation",
  monitor: "faq",
}

function splitIntoActions(text: string): string[] {
  // Split by sentence-ending period followed by a capital letter or end
  return text
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter((s) => s.length > 10)
}

function detectBucket(text: string): UrgencyBucket | null {
  const match = text.match(/\*{0,2}(immediate|short[\s-]?term|monitor)\s*:?\*{0,2}/i)
  if (!match) return null
  const raw = match[1].toLowerCase().replace(/[\s-]+/g, "_")
  if (raw === "immediate") return "immediate"
  if (raw.startsWith("short")) return "short_term"
  if (raw === "monitor") return "monitor"
  return null
}

function parseRecommendationsFromMarkdown(markdown: string): ActionItem[] {
  const lines = markdown.split("\n")
  const items: ActionItem[] = []

  let inSection = false
  let bucket: UrgencyBucket | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^##\s+Recommend/i.test(trimmed)) {
      inSection = true
      continue
    }
    if (inSection && /^##\s+/.test(trimmed)) break
    if (!inSection || !trimmed) continue

    // Check if this line sets a new bucket (header or inline)
    const detected = detectBucket(trimmed)
    if (detected) {
      bucket = detected
      // If inline format: "1. **Immediate:** action text here"
      const afterBucket = trimmed.replace(/^(?:\d+\.\s+)?[-*]*\s*\*{0,2}(?:immediate|short[\s-]?term|monitor)\s*:?\*{0,2}\s*:?\s*/i, "").trim()
      if (afterBucket) {
        for (const action of splitIntoActions(afterBucket)) {
          items.push({
            id: `act-${items.length + 1}`,
            type: URGENCY_TYPE[bucket],
            title: action,
            rationale: "",
            importance: URGENCY_IMPORTANCE[bucket],
            relatedClusterId: "",
          })
        }
      }
      continue
    }

    if (!bucket) continue

    // Indented bullet items: "   - Action text here"
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      const text = bulletMatch[1].trim()
      if (text.length > 10) {
        items.push({
          id: `act-${items.length + 1}`,
          type: URGENCY_TYPE[bucket],
          title: text,
          rationale: "",
          importance: URGENCY_IMPORTANCE[bucket],
          relatedClusterId: "",
        })
      }
      continue
    }

    // Non-bullet, non-empty line that isn't a numbered item — end bucket
    if (!/^\d+\./.test(trimmed)) bucket = null
  }

  return items
}

const MONETIZATION_KEYWORDS = /monetiz|pay.to.win|pricing|ad[\s-]?remov|ad[\s-]?frequen|forced\s+ad|unskippable|bundle/i
const MONETIZATION_MAX_IMPORTANCE = 5

function enrichActionsWithClusters(actions: ActionItem[], clusters: Cluster[]): ActionItem[] {
  return actions.map((action) => {
    const titleLower = action.title.toLowerCase()
    const isMonetization = MONETIZATION_KEYWORDS.test(action.title)
    const matched = clusters.find((c) => {
      const words = c.title.toLowerCase().split(/\s+/)
      return words.some((w) => w.length > 3 && titleLower.includes(w))
    })

    let importance = action.importance
    let rationale = action.rationale
    let clusterId = action.relatedClusterId

    if (matched) {
      const volumeBoost = Math.min(2, Math.floor(matched.volume7d / 10))
      const severityBoost = matched.severity >= 5 ? 1 : 0
      importance = Math.min(10, importance + volumeBoost + severityBoost)
      rationale = `${matched.volume7d} reports (severity ${matched.severity}/5, avg ${matched.ratingAvg}★). ${matched.recommendedAction}`
      clusterId = matched.id
    }

    if (isMonetization) {
      importance = Math.min(importance, MONETIZATION_MAX_IMPORTANCE)
    }

    return { ...action, importance, rationale, relatedClusterId: clusterId }
  })
}

function buildActionItems(
  alerts: Alert[],
  clusters: Cluster[],
  locale: SupportedLocale,
  markdown?: string,
): ActionItem[] {
  if (locale === "ru" && clusters.length) {
    return clusters.slice(0, 5).map((cluster, index) => ({
      id: `act-${index + 1}`,
      type: "investigation" as const,
      title: `Проверить ${cluster.title}`,
      rationale: cluster.recommendedAction,
      importance: importanceFromCluster(cluster),
      relatedClusterId: cluster.id,
    }))
  }

  // First try: parse structured recommendations from LLM-generated markdown
  if (markdown) {
    const parsed = parseRecommendationsFromMarkdown(markdown)
    if (parsed.length > 0) {
      return enrichActionsWithClusters(parsed, clusters).slice(0, 8)
    }
  }

  // Fallback: derive from clusters
  if (clusters.length) {
    return clusters.slice(0, 5).map((cluster, index) => ({
      id: `act-${index + 1}`,
      type: "investigation" as const,
      title: locale === "ru" ? `Проверить ${cluster.title}` : `Investigate ${cluster.title}`,
      rationale: cluster.recommendedAction,
      importance: importanceFromCluster(cluster),
      relatedClusterId: cluster.id,
    }))
  }

  if (locale === "ru" && alerts.length) {
    return alerts.slice(0, 3).map((alert, index) => ({
      id: `act-alert-${index + 1}`,
      type: actionTypeFromSeverity(alert.severity),
      title: `Проверить сигнал: ${alert.title}`,
      rationale: alert.description,
      importance: alert.severity === "critical" ? 9 : alert.severity === "high" ? 7 : 5,
      relatedClusterId: alert.clusterId || "",
    }))
  }

  return []
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

function normalizeReportLayer(
  key: ReportLayer["key"],
  raw: ApiReportLayer | undefined,
  fallbackTitle: string,
  fallbackNarrative: string,
): ReportLayer {
  return {
    key,
    title: String(raw?.title || fallbackTitle),
    narrative: String(raw?.narrative || fallbackNarrative),
    cards: (raw?.cards || []).map((card, index) => ({
      id: String(card.id || `${key}-card-${index + 1}`),
      title: String(card.title || "Untitled"),
      value: String(card.value || ""),
      description: card.description ? String(card.description) : undefined,
      severity: typeof card.severity === "number" ? Number(card.severity) : undefined,
      meta: card.meta && typeof card.meta === "object" ? card.meta : undefined,
    })),
    metrics: raw?.metrics && typeof raw.metrics === "object" ? raw.metrics : {},
    updatedAt: String(raw?.updated_at || new Date().toISOString()),
  }
}

export function buildDerivedReportLayers(
  reviews: Review[],
  alerts: Alert[],
  clusters: Cluster[],
  actionItems: ActionItem[],
): ReportLayers {
  const nowIso = new Date().toISOString()
  const totalReviews = reviews.length
  const negativeCount = reviews.filter((review) => review.sentiment === "negative").length
  const negativeShare = totalReviews ? negativeCount / totalReviews : 0
  const avgRating = totalReviews ? avg(reviews.map((review) => review.rating)) : 0

  const fallback = buildEmptyReportLayers(nowIso)
  fallback.summary = {
    key: "summary",
    title: "Сводка",
    narrative:
      totalReviews > 0
        ? `Анализ охватывает ${totalReviews} отзывов. Доля негатива: ${(negativeShare * 100).toFixed(1)}%, средняя оценка: ${avgRating.toFixed(2)}.`
        : "Недостаточно отзывов для формирования сводки.",
    cards: [
      {
        id: "summary-rating",
        title: "Average rating",
        value: avgRating.toFixed(2),
      },
      {
        id: "summary-negative-share",
        title: "Negative share",
        value: `${(negativeShare * 100).toFixed(1)}%`,
      },
      {
        id: "summary-sample",
        title: "Reviews analyzed",
        value: String(totalReviews),
      },
    ],
    metrics: {
      reviews_analyzed: totalReviews,
      negative_share: Number(negativeShare.toFixed(4)),
      avg_rating: Number(avgRating.toFixed(2)),
    },
    updatedAt: nowIso,
  }

  fallback.signals = {
    key: "signals",
    title: "Сигналы",
    narrative:
      alerts.length > 0
        ? `Выявлено ${alerts.length} активных сигналов. Приоритет: critical и spike.`
        : "Активных сигналов в выбранном окне не выявлено.",
    cards: alerts.slice(0, 5).map((alert) => ({
      id: alert.id,
      title: alert.title,
      value: `${alert.current}`,
      description: alert.description,
      meta: {
        severity: alert.severity,
        baseline: alert.baseline,
        metric: alert.metric,
      },
    })),
    metrics: {
      alerts_total: alerts.length,
      critical_alerts: alerts.filter((alert) => alert.severity === "critical").length,
      spike_alerts: alerts.filter((alert) => alert.type === "spike").length,
    },
    updatedAt: nowIso,
  }

  fallback.issues = {
    key: "issues",
    title: "Проблемы",
    narrative:
      clusters.length > 0
        ? "Проблемы отсортированы по severity и объему упоминаний."
        : "Кластеров проблем в выбранном окне не найдено.",
    cards: clusters.slice(0, 5).map((cluster) => ({
      id: cluster.id,
      title: cluster.title,
      value: `${cluster.volume7d}`,
      description: `Severity ${cluster.severity}/5 · trend ${cluster.trend}%`,
      severity: cluster.severity,
    })),
    metrics: {
      issues_total: clusters.length,
    },
    updatedAt: nowIso,
  }

  fallback.actions = {
    key: "actions",
    title: "Действия",
    narrative:
      actionItems.length > 0
        ? "Ниже предложенные действия и контрольные точки. Это не task-tracker статусы."
        : clusters.length > 0
          ? "Список действий сформирован из наиболее критичных кластеров."
          : "Список действий не сформирован.",
    cards:
      actionItems.length > 0
        ? actionItems.slice(0, 5).map((item) => ({
          id: item.id,
          title: item.title,
          value: `${item.importance}/10`,
          description: item.rationale,
          meta: {
            type: item.type,
            importance: item.importance,
          },
        }))
        : clusters.slice(0, 3).map((cluster, index) => ({
          id: `fallback-action-${index + 1}`,
          title: `Investigate ${cluster.title}`,
          value: `${importanceFromCluster(cluster)}/10`,
          description: cluster.recommendedAction,
          meta: {
            type: "investigation",
            importance: importanceFromCluster(cluster),
          },
        })),
    metrics: {
      suggested_actions: actionItems.length > 0 ? actionItems.length : Math.min(clusters.length, 3),
    },
    updatedAt: nowIso,
  }

  return fallback
}

function mapReportLayers(
  artifact: RunArtifact,
  reviews: Review[],
  alerts: Alert[],
  clusters: Cluster[],
  actionItems: ActionItem[],
): ReportLayers {
  const rawLayers = artifact.report_layers as ApiReportLayers | undefined
  if (!rawLayers) {
    return buildDerivedReportLayers(reviews, alerts, clusters, actionItems)
  }

  return {
    summary: normalizeReportLayer(
      "summary",
      rawLayers.summary,
      "Сводка",
      "Сводка отчета недоступна.",
    ),
    signals: normalizeReportLayer(
      "signals",
      rawLayers.signals,
      "Сигналы",
      "Сигналы недоступны.",
    ),
    issues: normalizeReportLayer(
      "issues",
      rawLayers.issues,
      "Проблемы",
      "Проблемные кластеры недоступны.",
    ),
    actions: normalizeReportLayer(
      "actions",
      rawLayers.actions,
      "Действия",
      "Рекомендации действий недоступны.",
    ),
  }
}

function extractExecutiveSummary(artifact: RunArtifact): string | undefined {
  const md = artifact.synthesis_markdown || artifact.markdown || ""
  if (!md) return undefined
  const lines = md.split("\n")
  let capturing = false
  const result: string[] = []
  for (const line of lines) {
    if (/^##\s+Executive\s+Summary/i.test(line)) {
      capturing = true
      continue
    }
    if (capturing && /^##\s+/.test(line)) break
    if (capturing) result.push(line)
  }
  const text = result.join("\n").trim()
  return text || undefined
}

export function mapRunArtifactToDashboard(
  artifact: RunArtifact,
  locale: SupportedLocale = "en",
): DashboardData {
  const platform = artifact.store || artifact.feedback_source || "google_play"
  const reviews = buildReviews(artifact).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
  const { clusters, clusterBySubcategory } = buildClusters(reviews, locale)
  const alerts = buildAlerts(artifact, clusterBySubcategory, locale)
  const avgRating = Number(
    artifact.stats?.avg_rating ??
      artifact.app_metadata?.score ??
      avg(reviews.map((review) => review.rating)) ??
      0,
  )

  const { issueStats, reputationStats } = buildIssueAndReputationStats(reviews, clusters, alerts, avgRating)
  const synthesisMarkdown = artifact.synthesis_markdown || artifact.markdown || ""
  const actionItems = buildActionItems(alerts, clusters, locale, synthesisMarkdown)
  const reportLayers = mapReportLayers(artifact, reviews, alerts, clusters, actionItems)
  const timelineData = buildTimeline(
    reviews,
    alerts,
    artifact.current_version?.version,
    artifact.current_version?.first_seen,
  )

  const totalReviews = Number(artifact.stats?.reviews_analyzed || 0) || reviews.length

  return {
    runId: artifact.run_id || null,
    appName: artifact.app_name || artifact.package_name || "Unknown app",
    packageName: artifact.package_name || "",
    countriesFetched: artifact.countries_fetched?.length
      ? artifact.countries_fetched.map((c) => c.toUpperCase())
      : [String(artifact.country || "us").toUpperCase()],
    product: {
      id: slugify(artifact.package_name || artifact.app_name || "app"),
      name: artifact.app_name || artifact.package_name || "Unknown app",
      packageId: artifact.package_name || "unknown.package",
      platform:
        platform === "app_store" || platform === "yandex_games" || platform === "vk_play" || platform === "steam" || platform === "multi_source"
          ? platform
          : "google_play",
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
    reportLayers,
    executiveSummary: extractExecutiveSummary(artifact),
    markdown: artifact.synthesis_markdown || artifact.markdown || undefined,
    lastUpdated: artifact.saved_at || artifact.fetched_at || new Date().toISOString(),
    source: "api",
  }
}
