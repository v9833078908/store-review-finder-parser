"use client"

import { StatusCards } from "@/components/command-center/status-cards"
import { TimelineChart } from "@/components/command-center/timeline-chart"
import { TopClusters } from "@/components/command-center/top-clusters"
import { ActionBoard } from "@/components/command-center/action-board"
import { MarkdownPanel } from "@/components/report/markdown-panel"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

export default function CommandCenterPage() {
  const { data, loading, error, source } = useDashboardData()
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)
  const sourceLabel = source === "api" ? text.common.sourceApi : source === "cache" ? text.common.sourceCache : text.common.sourceMock

  if (error?.startsWith("No active run")) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
          <h1 className="mb-3 text-2xl font-semibold tracking-tight">{text.pages.commandCenterTitle}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{error}</p>
          <Button asChild>
            <a href="/search-app">Open Search App</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{text.pages.commandCenterTitle}</h1>
        <p className="text-muted-foreground">
          {text.pages.commandCenterSubtitle}
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">{text.common.loadingDashboard}</div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {source !== "api" && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {text.common.showSourceData} {sourceLabel}.
        </div>
      )}

      <StatusCards
        reputation={data.reputationStats}
        issues={data.issueStats}
        response={data.responseStats}
      />

      <TimelineChart data={data.timelineData} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TopClusters clusters={data.clusters} />
        <ActionBoard actions={data.actionItems} />
      </div>

      <MarkdownPanel markdown={data.markdown} />
    </div>
  )
}
