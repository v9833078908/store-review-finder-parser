"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import type { Cluster } from "@/lib/types"
import { severityBadgeVariant, trendArrow, trendColor } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

interface TopClustersProps {
  clusters: Cluster[]
}

export function TopClusters({ clusters }: TopClustersProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)
  const topFive = clusters.slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.topClusters.title}</CardTitle>
        <CardDescription>{text.topClusters.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topFive.map((cluster) => (
            <div key={cluster.id} className="flex items-start justify-between gap-4 border-b pb-4 last:border-0">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Link href={`/issues/${cluster.id}`} className="font-medium hover:underline">
                    {cluster.title}
                  </Link>
                  <Badge variant={severityBadgeVariant(cluster.severity)}>
                    {text.topClusters.severity} {cluster.severity}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{cluster.volume7d} {text.topClusters.reports7d}</span>
                  <span className={trendColor(cluster.trend)}>
                    {trendArrow(cluster.trend)} {Math.abs(cluster.trend)}%
                  </span>
                  <span>★ {cluster.ratingAvg.toFixed(1)}</span>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{text.topClusters.top}: {cluster.topCountries.slice(0, 2).join(", ")}</span>
                  <span>·</span>
                  <span>{cluster.topLangs.slice(0, 2).join(", ")}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/issues/${cluster.id}`}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
