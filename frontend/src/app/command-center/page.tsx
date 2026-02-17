"use client"

import { useEffect, useMemo, useState } from "react"

import { StatusCards } from "@/components/command-center/status-cards"
import { TimelineChart } from "@/components/command-center/timeline-chart"
import { TopClusters } from "@/components/command-center/top-clusters"
import { ActionBoard } from "@/components/command-center/action-board"

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

export default function CommandCenterPage() {
  const { data, loading, error, source } = useDashboardData()
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
          {/* Left accent stripe */}
          <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-600">
              Executive Brief
            </span>
            <div className="h-px flex-1 bg-amber-200" />
          </div>
          <p className="text-sm leading-relaxed text-foreground/80">
            {data.executiveSummary}
          </p>
        </div>
      )}

      {visibleWidgets.has("status_cards") && (
        <StatusCards
          reputation={data.reputationStats}
          issues={data.issueStats}
          response={data.responseStats}
          kpiSet={config.kpi_set}
        />
      )}

      {visibleWidgets.has("timeline") && <TimelineChart data={data.timelineData} />}

      {(visibleWidgets.has("top_clusters") || visibleWidgets.has("action_board")) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {visibleWidgets.has("top_clusters") && <TopClusters clusters={data.clusters} />}
          {visibleWidgets.has("action_board") && <ActionBoard actions={data.actionItems} />}
        </div>
      )}

    </div>
  )
}
