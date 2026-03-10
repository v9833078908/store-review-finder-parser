import type { CommunityDataFile, CommunityMessage } from "@/lib/community-types"
import type {
  CommunityPulseStats,
  CommunityThread,
  Review,
  ReviewCategory,
  Sentiment,
  Severity,
  SourceComparisonItem,
  SourceComparisonStats,
} from "@/lib/types"

const TOPIC_TO_CATEGORY: Record<string, ReviewCategory> = {
  bugs: "bug",
  feature_request: "feature",
  content_update: "feature",
  ships: "complaint",
  events: "complaint",
  progression: "complaint",
  game_balance: "complaint",
  modules: "complaint",
  pilots: "complaint",
  monetization: "complaint",
  support: "complaint",
  ux: "complaint",
  community: "noise",
}

const CATEGORY_ORDER: ReviewCategory[] = ["bug", "complaint", "feature", "praise", "noise"]

function toIsoTimestamp(value: string | undefined): string {
  if (!value) return new Date().toISOString()
  const asIso = value.includes("T") ? value : value.replace(" ", "T")
  const withTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(asIso) ? asIso : `${asIso}Z`
  const parsed = new Date(withTimezone)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

function normalizeTopic(topic: string | undefined): string {
  return String(topic || "community").trim().toLowerCase() || "community"
}

function normalizeSentiment(sentiment: string | undefined): Sentiment {
  const normalized = String(sentiment || "neutral").trim().toLowerCase()
  if (normalized === "positive" || normalized === "negative" || normalized === "mixed" || normalized === "neutral") {
    return normalized
  }
  return "neutral"
}

function categoryFromTopic(topic: string): ReviewCategory {
  return TOPIC_TO_CATEGORY[topic] || "complaint"
}

function syntheticRating(sentiment: Sentiment): number {
  if (sentiment === "negative") return 2
  if (sentiment === "positive") return 5
  return 3
}

function communitySeverity(category: ReviewCategory, sentiment: Sentiment): Severity {
  if (category === "bug") return 4
  if (category === "feature") return 2
  if (category === "noise") return 1
  if (sentiment === "negative") return 3
  return 2
}

function topCounts(values: string[], limit = 3): Array<{ topic: string; count: number }> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const key = normalizeTopic(value)
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }))
}

function dominantSentiment(reviews: Review[]): Sentiment {
  const priority: Sentiment[] = ["negative", "mixed", "neutral", "positive"]
  const counts = new Map<Sentiment, number>()
  for (const review of reviews) {
    counts.set(review.sentiment, (counts.get(review.sentiment) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return priority.indexOf(a[0]) - priority.indexOf(b[0])
    })[0]?.[0] || "neutral"
}

export function mapCommunityToReviews(data: CommunityDataFile, productId: string): Review[] {
  const classified = data.classified || []

  return classified
    .map((message) => {
      const topic = normalizeTopic(message.topic)
      const sentiment = normalizeSentiment(message.sentiment)
      const category = categoryFromTopic(topic)

      return {
        id: `tg-${String(message.msg_id || "unknown")}`,
        productId,
        source: "community",
        rating: syntheticRating(sentiment),
        text: String(message.text || ""),
        lang: "ru",
        originalLang: "ru",
        country: "TG",
        appVersion: "community",
        category,
        subcategory: topic,
        sentiment,
        themes: [topic],
        severity: communitySeverity(category, sentiment),
        hasReply: false,
        createdAt: toIsoTimestamp(message.timestamp),
        communityTopic: topic,
        communityUsername: String(message.username || message.display_name || "").trim() || undefined,
        communityMsgId: String(message.msg_id || "").trim() || undefined,
      } satisfies Review
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function buildCommunityPulseStats(data: CommunityDataFile, reviews: Review[]): CommunityPulseStats {
  const classified = data.classified || []
  const noiseCount = Number(data.summary?.noise_count || data.noise?.length || 0)
  const signalCount = Number(data.summary?.signal_count || classified.length)
  const totalMessages = Number(data.summary?.total_messages || signalCount + noiseCount)

  const sentimentBreakdown = {
    positive: reviews.filter((review) => review.sentiment === "positive").length,
    negative: reviews.filter((review) => review.sentiment === "negative").length,
    neutral: reviews.filter((review) => review.sentiment === "neutral").length,
    mixed: reviews.filter((review) => review.sentiment === "mixed").length,
  }

  const parsedDates = classified
    .map((message) => toIsoTimestamp(message.timestamp))
    .map((iso) => new Date(iso))
    .filter((value) => !Number.isNaN(value.getTime()))

  const latestDate = parsedDates.length
    ? new Date(Math.max(...parsedDates.map((value) => value.getTime())))
    : new Date()

  const dayMs = 24 * 60 * 60 * 1000
  const dailyVolume7d = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(latestDate.getTime() - (6 - index) * dayMs)
    const key = day.toISOString().slice(0, 10)
    return {
      date: key,
      count: reviews.filter((review) => dateKey(review.createdAt) === key).length,
    }
  })

  return {
    totalMessages,
    signalCount,
    noiseCount,
    signalRatio: totalMessages ? Math.round((signalCount / totalMessages) * 100) : 0,
    topTopics: topCounts(classified.map((message) => message.topic || "community"), 3),
    sentimentBreakdown,
    dailyVolume7d,
  }
}

export function buildCommunityPulseFromReviews(
  reviews: Review[],
  totalMessages = reviews.length,
): CommunityPulseStats {
  const signalCount = reviews.length
  const noiseCount = Math.max(totalMessages - signalCount, 0)
  const parsedDates = reviews
    .map((review) => new Date(review.createdAt))
    .filter((value) => !Number.isNaN(value.getTime()))
  const latestDate = parsedDates.length
    ? new Date(Math.max(...parsedDates.map((value) => value.getTime())))
    : new Date()
  const dayMs = 24 * 60 * 60 * 1000

  return {
    totalMessages,
    signalCount,
    noiseCount,
    signalRatio: totalMessages ? Math.round((signalCount / totalMessages) * 100) : 0,
    topTopics: topCounts(reviews.map((review) => review.subcategory || review.communityTopic || "community"), 3),
    sentimentBreakdown: {
      positive: reviews.filter((review) => review.sentiment === "positive").length,
      negative: reviews.filter((review) => review.sentiment === "negative").length,
      neutral: reviews.filter((review) => review.sentiment === "neutral").length,
      mixed: reviews.filter((review) => review.sentiment === "mixed").length,
    },
    dailyVolume7d: Array.from({ length: 7 }, (_, index) => {
      const day = new Date(latestDate.getTime() - (6 - index) * dayMs)
      const key = day.toISOString().slice(0, 10)
      return {
        date: key,
        count: reviews.filter((review) => dateKey(review.createdAt) === key).length,
      }
    }),
  }
}

export function buildCommunityThreads(messages: CommunityMessage[]): CommunityThread[] {
  const groups = new Map<string, CommunityMessage[]>()

  for (const message of messages) {
    const topic = normalizeTopic(message.topic)
    const iso = toIsoTimestamp(message.timestamp)
    const key = `${topic}::${dateKey(iso)}`
    const list = groups.get(key) || []
    list.push(message)
    groups.set(key, list)
  }

  const threads = [...groups.entries()].map(([key, items]) => {
    const [topic, date] = key.split("::")
    const negativeCount = items.filter((item) => normalizeSentiment(item.sentiment) === "negative").length
    const relatedReviews: Review[] = items.map((item) => ({
      id: String(item.msg_id || ""),
      productId: "community",
      source: "community",
      rating: syntheticRating(normalizeSentiment(item.sentiment)),
      text: String(item.text || ""),
      lang: "ru",
      country: "TG",
      appVersion: "community",
      category: categoryFromTopic(topic),
      subcategory: topic,
      sentiment: normalizeSentiment(item.sentiment),
      themes: [topic],
      severity: 2,
      hasReply: false,
      createdAt: toIsoTimestamp(item.timestamp),
    }))

    const summaryCandidate = items
      .map((item) => String(item.summary || "").trim())
      .find((text) => text.length > 0)

    return {
      id: `thread-${topic}-${date}`,
      topic,
      date,
      messageCount: items.length,
      negativeCount,
      summary: summaryCandidate || String(items[0]?.text || "").slice(0, 180),
      sentiment: dominantSentiment(relatedReviews),
    } satisfies CommunityThread
  })

  return threads
    .sort((a, b) => {
      if (b.negativeCount !== a.negativeCount) return b.negativeCount - a.negativeCount
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    .slice(0, 3)
}

export function buildCommunityThreadsFromReviews(reviews: Review[]): CommunityThread[] {
  const groups = new Map<string, Review[]>()
  for (const review of reviews) {
    const topic = normalizeTopic(review.subcategory || review.communityTopic)
    const key = `${topic}::${dateKey(review.createdAt)}`
    const list = groups.get(key) || []
    list.push(review)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const [topic, date] = key.split("::")
      return {
        id: `thread-${topic}-${date}`,
        topic,
        date,
        messageCount: items.length,
        negativeCount: items.filter((item) => item.sentiment === "negative").length,
        summary: items[0]?.text.slice(0, 180) || "",
        sentiment: dominantSentiment(items),
      } satisfies CommunityThread
    })
    .sort((a, b) => {
      if (b.negativeCount !== a.negativeCount) return b.negativeCount - a.negativeCount
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    .slice(0, 3)
}

function issueTopics(reviews: Review[]): Set<string> {
  return new Set(
    reviews
      .filter((review) => review.category === "bug" || review.category === "complaint" || review.category === "feature")
      .map((review) => normalizeTopic(review.subcategory || review.communityTopic))
      .filter(Boolean),
  )
}

function dominantSentimentByTopic(reviews: Review[]): Map<string, Sentiment> {
  const byTopic = new Map<string, Review[]>()
  for (const review of reviews) {
    const topic = normalizeTopic(review.subcategory || review.communityTopic)
    const list = byTopic.get(topic) || []
    list.push(review)
    byTopic.set(topic, list)
  }

  const result = new Map<string, Sentiment>()
  for (const [topic, topicReviews] of byTopic.entries()) {
    result.set(topic, dominantSentiment(topicReviews))
  }
  return result
}

export function buildSourceComparison(googlePlayReviews: Review[], communityReviews: Review[]): SourceComparisonStats {
  const byCategory: SourceComparisonItem[] = CATEGORY_ORDER.map((category) => ({
    category,
    googlePlayCount: googlePlayReviews.filter((review) => review.category === category).length,
    communityCount: communityReviews.filter((review) => review.category === category).length,
  }))

  const gpTopics = issueTopics(googlePlayReviews)
  const tgTopics = issueTopics(communityReviews)

  const confirmedIssues = [...gpTopics].filter((topic) => tgTopics.has(topic)).sort()
  const storeBlindSpots = [...tgTopics].filter((topic) => !gpTopics.has(topic)).sort()
  const chatBlindSpots = [...gpTopics].filter((topic) => !tgTopics.has(topic)).sort()

  const gpSentiment = dominantSentimentByTopic(googlePlayReviews)
  const tgSentiment = dominantSentimentByTopic(communityReviews)

  const sentimentGaps = confirmedIssues
    .map((topic) => ({
      topic,
      googlePlaySentiment: gpSentiment.get(topic) || "neutral",
      communitySentiment: tgSentiment.get(topic) || "neutral",
    }))
    .filter((entry) => entry.googlePlaySentiment !== entry.communitySentiment)

  return {
    byCategory,
    confirmedIssues,
    storeBlindSpots,
    chatBlindSpots,
    sentimentGaps,
  }
}
