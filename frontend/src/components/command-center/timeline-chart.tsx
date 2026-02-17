"use client"

import { useMemo } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  Legend,
} from "recharts"
import type { TimelinePoint } from "@/lib/types"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { toIntlLocale } from "@/lib/i18n"

interface TimelineChartProps {
  data: TimelinePoint[]
}

interface ChartPoint {
  date: string
  negativeRate: number
  totalReviews: number
  negativeReviews: number
  releaseVersion?: string
}

export function TimelineChart({ data }: TimelineChartProps) {
  const { locale } = useDashboardPreferences()

  const chartData = useMemo<ChartPoint[]>(
    () =>
      data.map((point) => ({
        date: point.date,
        negativeRate:
          point.totalReviews > 0
            ? Math.round((point.negativeReviews / point.totalReviews) * 100)
            : 0,
        totalReviews: point.totalReviews,
        negativeReviews: point.negativeReviews,
        releaseVersion: point.releaseVersion,
      })),
    [data],
  )

  const totalLabel  = locale === "ru" ? "Объём отзывов" : "Review Volume"
  const negLabel    = locale === "ru" ? "Доля негатива, %" : "Negative Rate, %"

  const chartConfig = {
    totalReviews: { label: totalLabel,  color: "hsl(215 20% 65%)" },
    negativeRate:  { label: negLabel,   color: "hsl(0 72% 51%)"   },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{locale === "ru" ? "Таймлайн" : "Timeline"}</CardTitle>
        <CardDescription>
          {locale === "ru"
            ? "Объём отзывов (столбцы) и доля негатива (линия)"
            : "Review volume (bars) vs negative rate (line) — spike in line with flat bar = crisis signal"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString(toIntlLocale(locale), {
                  month: "short",
                  day: "numeric",
                })
              }
              className="text-xs"
              tick={{ fontSize: 11 }}
            />

            {/* Left axis — volume count */}
            <YAxis
              yAxisId="volume"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              width={32}
            />

            {/* Right axis — negative rate % */}
            <YAxis
              yAxisId="rate"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              width={40}
            />

            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const pt = payload[0]?.payload as ChartPoint
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                    <p className="mb-1.5 font-semibold">{label}</p>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(215 20% 65%)" }} />
                      <span className="text-muted-foreground">{totalLabel}:</span>
                      <span className="font-semibold">{pt.totalReviews}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(0 72% 51%)" }} />
                      <span className="text-muted-foreground">{negLabel}:</span>
                      <span className="font-semibold text-red-600">{pt.negativeRate}%</span>
                    </div>
                    <div className="text-muted-foreground mt-1">
                      ({pt.negativeReviews} / {pt.totalReviews})
                    </div>
                  </div>
                )
              }}
            />

            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => value === "totalReviews" ? totalLabel : negLabel}
            />

            {/* Release version markers */}
            {chartData.map((pt) =>
              pt.releaseVersion ? (
                <ReferenceLine
                  key={pt.date}
                  x={pt.date}
                  yAxisId="volume"
                  stroke="hsl(var(--primary))"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{
                    value: `v${pt.releaseVersion}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "hsl(var(--primary))",
                  }}
                />
              ) : null,
            )}

            {/* Bars — total review volume */}
            <Bar
              yAxisId="volume"
              dataKey="totalReviews"
              fill="hsl(215 20% 65%)"
              fillOpacity={0.55}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />

            {/* Line — negative rate */}
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="negativeRate"
              stroke="hsl(0 72% 51%)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "hsl(0 72% 51%)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
