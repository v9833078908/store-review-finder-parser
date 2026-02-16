"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts"
import type { TimelinePoint } from "@/lib/types"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText, toIntlLocale } from "@/lib/i18n"

interface TimelineChartProps {
  data: TimelinePoint[]
}

export function TimelineChart({ data }: TimelineChartProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  const chartConfig = {
    negativeReviews: {
      label: text.timelineChart.negativeReviews,
      color: "hsl(var(--chart-1))",
    },
    bugReports: {
      label: text.timelineChart.bugReports,
      color: "hsl(var(--chart-2))",
    },
    alerts: {
      label: text.timelineChart.alerts,
      color: "hsl(var(--chart-3))",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.timelineChart.title}</CardTitle>
        <CardDescription>{text.timelineChart.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString(toIntlLocale(locale), {
                  month: "short",
                  day: "numeric",
                })
              }}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <ChartTooltip content={<ChartTooltipContent />} />

            {data.map((point) =>
              point.releaseVersion ? (
                <ReferenceLine
                  key={point.date}
                  x={point.date}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="3 3"
                  label={{
                    value: `v${point.releaseVersion}`,
                    position: "top",
                    className: "text-xs font-medium fill-primary",
                  }}
                />
              ) : null
            )}

            <Area
              type="monotone"
              dataKey="negativeReviews"
              stackId="1"
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="bugReports"
              stackId="1"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="alerts"
              stackId="1"
              stroke="hsl(var(--chart-3))"
              fill="hsl(var(--chart-3))"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
