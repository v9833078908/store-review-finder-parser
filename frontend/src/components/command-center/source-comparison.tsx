"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts"
import type { SourceComparisonStats } from "@/lib/types"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatCategory, formatThemeLabel, formatSentiment, getUiText } from "@/lib/i18n"

interface SourceComparisonProps {
  comparison: SourceComparisonStats
}

function InsightList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <Badge key={`${title}-${item}`} variant="secondary" className="text-xs">
              {item}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">{empty}</span>
        )}
      </div>
    </div>
  )
}

export function SourceComparison({ comparison }: SourceComparisonProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  const chartData = comparison.byCategory.map((item) => ({
    category: formatCategory(item.category, locale),
    googlePlay: item.googlePlayCount,
    community: item.communityCount,
  }))

  const chartConfig = {
    googlePlay: {
      label: text.sourceComparison.googlePlay,
      color: "hsl(213 94% 52%)",
    },
    community: {
      label: text.sourceComparison.community,
      color: "hsl(252 83% 61%)",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.sourceComparison.title}</CardTitle>
        <CardDescription>{text.sourceComparison.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 text-xs text-muted-foreground">{text.sourceComparison.chartDescription}</div>
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="googlePlay" fill="var(--color-googlePlay)" radius={3} />
              <Bar dataKey="community" fill="var(--color-community)" radius={3} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="space-y-3">
          <InsightList
            title={text.sourceComparison.confirmedIssues}
            items={comparison.confirmedIssues.map((item) => formatThemeLabel(item, locale))}
            empty={text.sourceComparison.noData}
          />
          <InsightList
            title={text.sourceComparison.storeBlindSpots}
            items={comparison.storeBlindSpots.map((item) => formatThemeLabel(item, locale))}
            empty={text.sourceComparison.noData}
          />
          <InsightList
            title={text.sourceComparison.chatBlindSpots}
            items={comparison.chatBlindSpots.map((item) => formatThemeLabel(item, locale))}
            empty={text.sourceComparison.noData}
          />
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-semibold">{text.sourceComparison.sentimentGaps}</div>
            {comparison.sentimentGaps.length > 0 ? (
              <div className="space-y-1.5">
                {comparison.sentimentGaps.map((gap) => (
                  <div key={gap.topic} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatThemeLabel(gap.topic, locale)}</span>
                    {": "}
                    {text.sourceComparison.googlePlay} {formatSentiment(gap.googlePlaySentiment, locale)} · {text.sourceComparison.community} {formatSentiment(gap.communitySentiment, locale)}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{text.sourceComparison.noData}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
