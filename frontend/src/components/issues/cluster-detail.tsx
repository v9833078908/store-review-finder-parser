"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import type { Cluster, Review } from "@/lib/types"
import { severityBadgeVariant, statusColor, formatDateTime, trendArrow, trendColor } from "@/lib/utils"
import { Star } from "lucide-react"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatClusterStatus, getUiText } from "@/lib/i18n"

interface ClusterDetailProps {
  cluster: Cluster
  reviews: Review[]
}

export function ClusterDetail({ cluster, reviews }: ClusterDetailProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  const chartConfig = {
    count: {
      label: text.clusterDetail.count,
      color: "hsl(var(--chart-1))",
    },
  }

  const versionBreakdown = cluster.topVersions.map((v) => ({
    name: v,
    count: reviews.filter((r) => r.appVersion === v).length,
  }))

  const countryBreakdown = cluster.topCountries.map((c) => ({
    name: c,
    count: reviews.filter((r) => r.country === c).length,
  }))

  const langBreakdown = cluster.topLangs.map((l) => ({
    name: l,
    count: reviews.filter((r) => r.lang === l).length,
  }))

  const exampleReviews = reviews.slice(0, 5)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{cluster.title}</CardTitle>
              <CardDescription>{text.clusterDetail.summary}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={severityBadgeVariant(cluster.severity)}>
                {text.clusterList.severity} {cluster.severity}
              </Badge>
              <Badge className={statusColor(cluster.status)}>
                {formatClusterStatus(cluster.status, locale)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {cluster.summary}
          </p>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">{text.clusterDetail.volume7Days}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-2xl font-bold">{cluster.volume7d}</div>
                <span className={`text-sm ${trendColor(cluster.trend)}`}>
                  {trendArrow(cluster.trend)} {Math.abs(cluster.trend)}%
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">{text.clusterDetail.avgRating}</div>
              <div className="mt-1 flex items-center gap-1 text-2xl font-bold">
                {cluster.ratingAvg.toFixed(1)}
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">{text.clusterDetail.reports24h}</div>
              <div className="mt-1 text-2xl font-bold">{cluster.volume24h}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{text.clusterDetail.whyProblem}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>
              {text.clusterDetail.growthRate}:{" "}
              <span className={`font-medium ${trendColor(cluster.trend)}`}>
                {cluster.trend > 0 ? `+${cluster.trend}` : cluster.trend}%
              </span>{" "}
              {locale === "ru" ? "к предыдущему периоду" : "vs previous period"}
            </li>
            <li>
              {text.clusterDetail.ratingImpact}: {cluster.ratingAvg.toFixed(1)}/5.0
            </li>
            <li>
              {text.clusterList.severity} {cluster.severity}: {text.clusterDetail.severityClassification}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{text.clusterDetail.exampleReviews}</CardTitle>
          <CardDescription>{text.clusterDetail.recentReports}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {exampleReviews.map((review) => (
              <div key={review.id} className="space-y-2 border-b pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.originalLang || review.lang} · {review.country}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(review.createdAt, locale)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{review.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{text.clusterDetail.byVersion}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={versionBreakdown}>
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{text.clusterDetail.byCountry}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={countryBreakdown}>
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{text.clusterDetail.byLanguage}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={langBreakdown}>
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{text.clusterDetail.recommendedAction}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {cluster.recommendedAction}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
