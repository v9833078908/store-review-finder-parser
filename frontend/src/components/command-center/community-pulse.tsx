"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis } from "recharts"
import type { CommunityPulseStats } from "@/lib/types"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatThemeLabel, getUiText } from "@/lib/i18n"

interface CommunityPulseProps {
  stats: CommunityPulseStats
}

function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

export function CommunityPulse({ stats }: CommunityPulseProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)
  const sentimentTotal =
    stats.sentimentBreakdown.positive +
    stats.sentimentBreakdown.negative +
    stats.sentimentBreakdown.neutral +
    stats.sentimentBreakdown.mixed

  const chartConfig = {
    volume: {
      label: text.communityPulse.messages,
      color: "hsl(252 83% 61%)",
    },
  }

  return (
    <Card className="relative overflow-hidden border-l-4 border-l-violet-500">
      <CardHeader className="pb-3">
        <CardTitle>{text.communityPulse.title}</CardTitle>
        <CardDescription>{text.communityPulse.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{text.communityPulse.signalRatio}</div>
            <div className="font-mono text-3xl font-bold leading-none">{stats.signalRatio}%</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              {stats.signalCount} {text.communityPulse.signals}
            </div>
            <div>
              {stats.totalMessages} {text.communityPulse.messages}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">{text.communityPulse.topTopics}</div>
          <div className="flex flex-wrap gap-1.5">
            {stats.topTopics.map((topic) => (
              <Badge key={topic.topic} variant="secondary" className="text-xs">
                {formatThemeLabel(topic.topic, locale)} · {topic.count}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">{text.communityPulse.sentiment}</div>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div className="bg-red-500" style={{ width: `${pct(stats.sentimentBreakdown.negative, sentimentTotal)}%` }} />
            <div className="bg-amber-400" style={{ width: `${pct(stats.sentimentBreakdown.mixed, sentimentTotal)}%` }} />
            <div className="bg-sky-400" style={{ width: `${pct(stats.sentimentBreakdown.neutral, sentimentTotal)}%` }} />
            <div className="bg-emerald-500" style={{ width: `${pct(stats.sentimentBreakdown.positive, sentimentTotal)}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">{text.communityPulse.dailyVolume}</div>
          <ChartContainer config={chartConfig} className="h-[92px] w-full">
            <LineChart data={stats.dailyVolume7d}>
              <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="count"
                name="volume"
                stroke="var(--color-volume)"
                strokeWidth={2}
                dot={false}
                type="monotone"
              />
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
