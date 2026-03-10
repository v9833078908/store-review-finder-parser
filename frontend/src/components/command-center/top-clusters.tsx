"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import type { Cluster, Review } from "@/lib/types"
import { trendArrow, trendColor } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"
import { useMemo } from "react"

interface TopClustersProps {
  clusters: Cluster[]
  reviews: Review[]
}

export function TopClusters({ clusters, reviews }: TopClustersProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)
  const topFive = clusters.slice(0, 5)
  const reviewsById = useMemo(() => new Map(reviews.map((review) => [review.id, review])), [reviews])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.topClusters.title}</CardTitle>
        <CardDescription>{text.topClusters.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {topFive.map((cluster) => {
            const sourceCounts = cluster.reviewIds.reduce(
              (acc, reviewId) => {
                const review = reviewsById.get(reviewId)
                if (review?.source === "community") {
                  acc.tg += 1
                } else if (review?.source === "google_play") {
                  acc.gp += 1
                }
                return acc
              },
              { gp: 0, tg: 0 },
            )
            const severityColors: Record<number, { bar: string; bg: string; text: string }> = {
              5: { bar: "bg-red-500",    bg: "bg-red-50/60",    text: "text-red-700"    },
              4: { bar: "bg-orange-400", bg: "bg-orange-50/40", text: "text-orange-700" },
              3: { bar: "bg-yellow-400", bg: "bg-yellow-50/40", text: "text-yellow-700" },
              2: { bar: "bg-sky-400",    bg: "bg-sky-50/30",    text: "text-sky-700"    },
              1: { bar: "bg-zinc-300",   bg: "",                text: "text-zinc-500"   },
            }
            const s = severityColors[cluster.severity] ?? severityColors[1]
            return (
              <div
                key={cluster.id}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40 ${s.bg}`}
              >
                {/* Severity stripe */}
                <div className={`absolute left-0 top-1/2 h-[60%] w-1 -translate-y-1/2 rounded-r-full ${s.bar}`} />

                <div className="flex-1 space-y-0.5 pl-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/issues/${cluster.id}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {cluster.title}
                    </Link>
                    <span className={`font-mono text-[11px] font-bold ${s.text}`}>
                      S{cluster.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{cluster.volume7d} {text.topClusters.reports7d}</span>
                    <span className={`font-medium ${trendColor(cluster.trend)}`}>
                      {trendArrow(cluster.trend)} {Math.abs(cluster.trend)}%
                    </span>
                    <span>★ {cluster.ratingAvg.toFixed(1)}</span>
                    <span>GP: {sourceCounts.gp} · TG: {sourceCounts.tg}</span>
                    <span>{cluster.topCountries.slice(0, 2).join(", ")} · {cluster.topLangs.slice(0, 2).join(", ")}</span>
                  </div>
                </div>

                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                  <Link href={`/issues/${cluster.id}`}>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
