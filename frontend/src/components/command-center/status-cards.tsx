"use client"

import { useState } from "react"
import { TrendingDown, AlertTriangle, MessageCircleOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ReputationStats, IssueStats, ResponseStats } from "@/lib/types"
import { trendArrow, trendColor } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"
import type { DashboardKpiKey } from "@/lib/dashboard-config"

const VISIBLE_COUNTRIES = 5

function CountryBreakdown({
  filteredReviewCount,
  countriesFetched,
  label,
}: {
  filteredReviewCount: number
  countriesFetched: string[]
  label: string
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? countriesFetched : countriesFetched.slice(0, VISIBLE_COUNTRIES)
  const overflow = countriesFetched.length - VISIBLE_COUNTRIES

  return (
    <div className="mt-3 space-y-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 dark:bg-sky-950/40">
      <span className="text-xs text-sky-600 dark:text-sky-400">
        {label.replace("{count}", String(filteredReviewCount))}
      </span>
      {countriesFetched.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {shown.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300"
            >
              {c}
            </span>
          ))}
          {!expanded && overflow > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-200/70 text-sky-600 hover:bg-sky-200 dark:bg-sky-800/60 dark:text-sky-400 dark:hover:bg-sky-800 transition-colors cursor-pointer"
            >
              +{overflow}
            </button>
          )}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-200/70 text-sky-600 hover:bg-sky-200 dark:bg-sky-800/60 dark:text-sky-400 transition-colors cursor-pointer"
            >
              ↑
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface StatusCardsProps {
  reputation: ReputationStats
  issues: IssueStats
  response: ResponseStats
  kpiSet: DashboardKpiKey[]
  filteredReviewCount: number
  countriesFetched: string[]
}

export function StatusCards({ reputation, issues, response, kpiSet, filteredReviewCount, countriesFetched }: StatusCardsProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)
  const enabled = new Set<DashboardKpiKey>(kpiSet)

  const showReputationCard =
    enabled.has("current_rating") ||
    enabled.has("rating_trend") ||
    enabled.has("low_rating_share") ||
    enabled.has("low_rating_share_change")
  const showIssuesCard =
    enabled.has("new_clusters") ||
    enabled.has("spike_count") ||
    enabled.has("critical_count")
  const showResponseCard =
    enabled.has("unanswered_percent") ||
    enabled.has("unanswered_negatives") ||
    enabled.has("total_unanswered")

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {showReputationCard && (
        <Card className="relative overflow-hidden border-l-4 border-l-amber-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{text.statusCards.reputation}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50">
              <TrendingDown className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              {enabled.has("current_rating") ? (
                <div className="font-mono text-3xl font-bold tracking-tight">{reputation.currentRating.toFixed(2)}</div>
              ) : (
                <div className="font-mono text-3xl font-bold text-muted-foreground">—</div>
              )}
              {enabled.has("rating_trend") && (
                <span className={`text-sm font-semibold ${trendColor(reputation.ratingTrend, true)}`}>
                  {trendArrow(reputation.ratingTrend)} {Math.abs(reputation.ratingTrend).toFixed(2)}
                </span>
              )}
            </div>
            {enabled.has("low_rating_share") && (
              <div className="mt-2 text-xs text-muted-foreground">
                {text.statusCards.lowRatingShare}:{" "}
                <span className="font-semibold text-foreground">{(reputation.lowRatingShare * 100).toFixed(0)}%</span>
                {enabled.has("low_rating_share_change") && (
                  <span className={`ml-1 font-medium ${trendColor(reputation.lowRatingShareChange)}`}>
                    ({reputation.lowRatingShareChange > 0 ? "+" : ""}{(reputation.lowRatingShareChange * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showIssuesCard && (
        <Card className={`relative overflow-hidden border-l-4 ${issues.criticalCount > 0 ? "border-l-red-500" : "border-l-orange-400"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{text.statusCards.newIssues}</CardTitle>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${issues.criticalCount > 0 ? "bg-red-50" : "bg-orange-50"}`}>
              <AlertTriangle className={`h-4 w-4 ${issues.criticalCount > 0 ? "text-red-600" : "text-orange-500"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              {enabled.has("new_clusters") ? (
                <div className="font-mono text-3xl font-bold tracking-tight">{issues.newClusters}</div>
              ) : (
                <div className="font-mono text-3xl font-bold text-muted-foreground">—</div>
              )}
              <span className="text-xs text-muted-foreground">{text.statusCards.clustersSinceRelease}</span>
            </div>
            <div className="mt-2 flex gap-2">
              {enabled.has("spike_count") && issues.spikeCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {issues.spikeCount} {text.statusCards.spike}{issues.spikeCount > 1 ? "s" : ""}
                </Badge>
              )}
              {enabled.has("critical_count") && issues.criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {issues.criticalCount} {text.statusCards.critical}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showResponseCard && (
        <Card className="relative overflow-hidden border-l-4 border-l-sky-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{text.statusCards.responseCoverage}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50">
              <MessageCircleOff className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              {enabled.has("unanswered_percent") ? (
                <div className="font-mono text-3xl font-bold tracking-tight">{response.unansweredPercent}%</div>
              ) : (
                <div className="font-mono text-3xl font-bold text-muted-foreground">—</div>
              )}
              <span className="text-xs text-muted-foreground">{text.statusCards.withoutReply}</span>
            </div>
            {(enabled.has("unanswered_negatives") || enabled.has("total_unanswered")) && (
              <div className="mt-2 text-xs text-muted-foreground">
                {enabled.has("unanswered_negatives") && (
                  <>
                    <span className="font-semibold text-destructive">{response.unansweredNegatives}</span>{" "}
                    {text.statusCards.unansweredNegatives}
                  </>
                )}
                {enabled.has("total_unanswered") && (
                  <span className="ml-1">({response.totalUnanswered} {text.statusCards.total})</span>
                )}
              </div>
            )}
            <CountryBreakdown
              filteredReviewCount={filteredReviewCount}
              countriesFetched={countriesFetched}
              label={text.statusCards.basedOnReviews}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
