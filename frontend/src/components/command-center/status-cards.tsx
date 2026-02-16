"use client"

import { TrendingDown, AlertTriangle, MessageCircleOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ReputationStats, IssueStats, ResponseStats } from "@/lib/types"
import { trendArrow, trendColor } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

interface StatusCardsProps {
  reputation: ReputationStats
  issues: IssueStats
  response: ResponseStats
}

export function StatusCards({ reputation, issues, response }: StatusCardsProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{text.statusCards.reputation}</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">{reputation.currentRating.toFixed(2)}</div>
            <span className={`text-sm font-medium ${trendColor(reputation.ratingTrend, true)}`}>
              {trendArrow(reputation.ratingTrend)} {Math.abs(reputation.ratingTrend).toFixed(2)}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {text.statusCards.lowRatingShare}:{" "}
            <span className="font-medium">{(reputation.lowRatingShare * 100).toFixed(0)}%</span>
            <span className={`ml-1 ${trendColor(reputation.lowRatingShareChange)}`}>
              ({reputation.lowRatingShareChange > 0 ? "+" : ""}{(reputation.lowRatingShareChange * 100).toFixed(0)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{text.statusCards.newIssues}</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">{issues.newClusters}</div>
            <span className="text-xs text-muted-foreground">{text.statusCards.clustersSinceRelease}</span>
          </div>
          <div className="mt-2 flex gap-2">
            {issues.spikeCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {issues.spikeCount} {text.statusCards.spike}{issues.spikeCount > 1 ? "s" : ""}
              </Badge>
            )}
            {issues.criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {issues.criticalCount} {text.statusCards.critical}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{text.statusCards.responseCoverage}</CardTitle>
          <MessageCircleOff className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">{response.unansweredPercent}%</div>
            <span className="text-xs text-muted-foreground">{text.statusCards.withoutReply}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-destructive">{response.unansweredNegatives}</span> {text.statusCards.unansweredNegatives}
            <span className="ml-1">({response.totalUnanswered} {text.statusCards.total})</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
