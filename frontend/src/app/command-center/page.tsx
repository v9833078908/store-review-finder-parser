"use client"

import { useEffect, useMemo, useState } from "react"

import { StatusCards } from "@/components/command-center/status-cards"
import { TimelineChart } from "@/components/command-center/timeline-chart"
import { TopClusters } from "@/components/command-center/top-clusters"
import { ActionBoard } from "@/components/command-center/action-board"
import { CommunityPulse } from "@/components/command-center/community-pulse"
import { SourceComparison } from "@/components/command-center/source-comparison"
import { CommunityThreads } from "@/components/command-center/community-threads"
import { SourceFilterToggle } from "@/components/command-center/source-filter-toggle"

import { DashboardCustomizer } from "@/components/command-center/dashboard-customizer"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  buildDefaultDashboardConfig,
  type DashboardConfig,
  type DashboardRoleProfile,
} from "@/lib/dashboard-config"
import type { FeedbackSource } from "@/lib/types"

export default function CommandCenterPage() {
  const [sourceFilter, setSourceFilter] = useState<FeedbackSource | null>(null)
  const { data, loading, error, source } = useDashboardData(sourceFilter)
  const { locale, loadDashboardConfig, saveDashboardConfig } = useDashboardPreferences()
  const text = getUiText(locale)
  const sourceLabel = source === "api" ? text.common.sourceApi : source === "cache" ? text.common.sourceCache : text.common.sourceMock
  const packageName = data.packageName || data.appName || "unknown.package"

  const [roleProfile, setRoleProfile] = useState<DashboardRoleProfile>("producer")
  const [config, setConfig] = useState<DashboardConfig>(() => buildDefaultDashboardConfig(packageName, roleProfile))
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      if (!packageName || packageName === "unknown.package") return
      setConfigLoading(true)
      try {
        const resolved = await loadDashboardConfig(packageName, roleProfile)
        if (!active) return
        setConfig(resolved)
      } finally {
        if (active) setConfigLoading(false)
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [loadDashboardConfig, packageName, roleProfile])

  const visibleWidgets = useMemo(() => new Set(config.visible_widgets), [config.visible_widgets])
  const showCommunityData = data.communityDataLoaded

  const showCommunityPulse =
    showCommunityData &&
    sourceFilter !== "google_play" &&
    visibleWidgets.has("community_pulse") &&
    Boolean(data.communityPulse)

  const showSourceComparison =
    showCommunityData &&
    sourceFilter === null &&
    visibleWidgets.has("source_comparison") &&
    Boolean(data.sourceComparison)

  const showCommunityThreads =
    showCommunityData &&
    sourceFilter !== "google_play" &&
    visibleWidgets.has("community_threads") &&
    Boolean(data.communityThreads?.length)

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

  const showTopClusters = visibleWidgets.has("top_clusters")
  const showActionBoard = visibleWidgets.has("action_board")

  const communityThreadsPanel = showCommunityThreads ? <CommunityThreads threads={data.communityThreads || []} /> : null

  const boardGridColumns = showCommunityThreads
    ? "xl:grid-cols-3"
    : showTopClusters && showActionBoard
      ? "xl:grid-cols-2"
      : "xl:grid-cols-1"

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{text.pages.commandCenterTitle}</h1>
          <p className="text-muted-foreground">
            {text.pages.commandCenterSubtitle}
          </p>
        </div>
        <DashboardCustomizer
          packageName={packageName}
          config={config}
          loading={configLoading}
          saving={configSaving}
          onRoleChange={(nextRole) => setRoleProfile(nextRole)}
          onSave={async (payload) => {
            setConfigSaving(true)
            try {
              const saved = await saveDashboardConfig(packageName, roleProfile, payload)
              setConfig(saved)
            } finally {
              setConfigSaving(false)
            }
          }}
        />
      </div>

      {showCommunityData && (
        <SourceFilterToggle value={sourceFilter} onChange={setSourceFilter} />
      )}

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

      {data.executiveSummary && (
        <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-5 shadow-sm">
          <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600">
              Executive Brief
            </span>
            <div className="h-px flex-1 bg-amber-200" />
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">
            {data.executiveSummary}
          </p>
        </div>
      )}

      {(visibleWidgets.has("status_cards") || showCommunityPulse) && (
        <div className={`grid gap-4 ${visibleWidgets.has("status_cards") && showCommunityPulse ? "xl:grid-cols-4" : "xl:grid-cols-1"}`}>
          {visibleWidgets.has("status_cards") && (
            <div className={showCommunityPulse ? "xl:col-span-3" : undefined}>
              <StatusCards
                reputation={data.reputationStats}
                issues={data.issueStats}
                response={data.responseStats}
                kpiSet={config.kpi_set}
                filteredReviewCount={data.reviews.length}
                countriesFetched={data.countriesFetched}
              />
            </div>
          )}
          {showCommunityPulse && data.communityPulse && (
            <CommunityPulse stats={data.communityPulse} />
          )}
        </div>
      )}

      {visibleWidgets.has("timeline") && <TimelineChart data={data.timelineData} />}

      {showSourceComparison && data.sourceComparison && (
        <SourceComparison comparison={data.sourceComparison} />
      )}

      {(showTopClusters || showActionBoard || showCommunityThreads) && (
        <div className={`grid gap-6 ${boardGridColumns}`}>
          {showTopClusters && <TopClusters clusters={data.clusters} reviews={data.reviews} />}
          {showActionBoard && <ActionBoard actions={data.actionItems} />}
          {communityThreadsPanel}
        </div>
      )}

    </div>
  )
}
