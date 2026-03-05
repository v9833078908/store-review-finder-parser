"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { RunArtifact, RunHistoryItem, RunHistoryResponse } from "@/lib/api-types"
import type { DashboardData, DashboardDataSource } from "@/lib/dashboard-types"
import { buildEmptyReportLayers } from "@/lib/dashboard-types"
import { mapRunArtifactToDashboard } from "@/lib/runtime-mapper"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { filterDashboardDataByDate } from "@/lib/dashboard-filtering"

const STORAGE_KEY_PREFIX = "review-dashboard:data:v2"
const TAB_RUN_ID_KEY = "review-dashboard:active-run-id:tab:v1"
const LEGACY_RUN_ID_KEY = "review-dashboard:run-id:v1"

interface DashboardState {
  data: DashboardData
  source: DashboardDataSource
  loading: boolean
  error: string | null
}

interface RunHistoryState {
  history: RunHistoryItem[]
  loading: boolean
  error: string | null
}

interface RunFetchFilters {
  locale: string
  period: string
  dateFrom: string
  dateTo: string
}

class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run not found: ${runId}`)
    this.name = "RunNotFoundError"
  }
}

function buildEmptyDashboardData(): DashboardData {
  return {
    runId: null,
    appName: "No active run",
    packageName: "",
    countriesFetched: [],
    product: {
      id: "none",
      name: "No active run",
      packageId: "",
      platform: "google_play",
      rating: 0,
      totalReviews: 0,
    },
    reputationStats: {
      currentRating: 0,
      ratingTrend: 0,
      lowRatingShare: 0,
      lowRatingShareChange: 0,
    },
    issueStats: {
      newClusters: 0,
      spikeCount: 0,
      criticalCount: 0,
    },
    responseStats: {
      unansweredPercent: 0,
      unansweredNegatives: 0,
      totalUnanswered: 0,
    },
    timelineData: [],
    reviews: [],
    clusters: [],
    alerts: [],
    actionItems: [],
    reportLayers: buildEmptyReportLayers(),
    markdown: undefined,
    lastUpdated: new Date().toISOString(),
    source: "api",
  }
}

async function fetchRunArtifact(runId: string, filters: RunFetchFilters): Promise<RunArtifact> {
  const url = new URL(`/api/runs/${encodeURIComponent(runId)}`, window.location.origin)
  url.searchParams.set("lang", filters.locale)
  url.searchParams.set("period", filters.period)
  url.searchParams.set("date_from", filters.dateFrom)
  url.searchParams.set("date_to", filters.dateTo)

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  })
  if (response.status === 404) {
    throw new RunNotFoundError(runId)
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch run ${runId} (${response.status})`)
  }
  return (await response.json()) as RunArtifact
}

async function fetchRunHistoryFromApi(limit = 10): Promise<RunHistoryResponse> {
  const url = new URL("/api/runs", window.location.origin)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("unique_apps", "true")
  const response = await fetch(url.toString(), { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to fetch run history (${response.status})`)
  }
  return (await response.json()) as RunHistoryResponse
}

async function fetchLatestRunId(): Promise<string | null> {
  try {
    const data = await fetchRunHistoryFromApi(1)
    return data.items[0]?.run_id ?? null
  } catch {
    return null
  }
}

function buildStorageKey(scope: string): string {
  return `${STORAGE_KEY_PREFIX}:${scope}`
}

function buildScope(runId: string | null, filters: RunFetchFilters): string {
  return [runId || "last", filters.locale, filters.period, filters.dateFrom, filters.dateTo].join("::")
}

function readCachedDashboard(scope: string): DashboardData | null {
  try {
    const raw = localStorage.getItem(buildStorageKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardData
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

function writeCachedDashboard(scope: string, data: DashboardData): void {
  try {
    localStorage.setItem(buildStorageKey(scope), JSON.stringify(data))
    if (data.runId) {
      localStorage.setItem(TAB_RUN_ID_KEY, data.runId)
      localStorage.setItem(LEGACY_RUN_ID_KEY, data.runId)
    }
  } catch {
    // Ignore storage write failures.
  }
}

export function useDashboardData() {
  const searchParams = useSearchParams()
  const searchRunId = searchParams.get("run_id")
  const { locale, dateFilter, resolvedDateRange } = useDashboardPreferences()

  const requestFilters = useMemo(
    () => ({
      locale,
      period: dateFilter.preset,
      dateFrom: resolvedDateRange.from.toISOString(),
      dateTo: resolvedDateRange.to.toISOString(),
    }),
    [dateFilter.preset, locale, resolvedDateRange.from, resolvedDateRange.to],
  )

  const [state, setState] = useState<DashboardState>(() => ({
    data: buildEmptyDashboardData(),
    source: "api",
    loading: false,
    error: null,
  }))

  const [runHistoryState, setRunHistoryState] = useState<RunHistoryState>({
    history: [],
    loading: false,
    error: null,
  })

  const [warning, setWarning] = useState<string | null>(null)

  const refreshRunHistory = useCallback(async () => {
    setRunHistoryState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchRunHistoryFromApi(10)
      setRunHistoryState({ history: data.items, loading: false, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load run history"
      setRunHistoryState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [])

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    setWarning(null)

    const runIdFromStorage = typeof window !== "undefined" ? localStorage.getItem(TAB_RUN_ID_KEY) : null
    const runIdFromLegacy = typeof window !== "undefined" ? localStorage.getItem(LEGACY_RUN_ID_KEY) : null
    let targetRunId = searchRunId || runIdFromStorage || runIdFromLegacy

    // Fallback: if no run_id available, try the most recent run from server
    if (!targetRunId) {
      targetRunId = await fetchLatestRunId()
      if (!targetRunId) {
        setState({
          data: buildEmptyDashboardData(),
          source: "api",
          loading: false,
          error: "No active run. Generate a report from Search App first.",
        })
        return
      }
    }

    const scope = buildScope(targetRunId, requestFilters)

    try {
      const artifact = await fetchRunArtifact(targetRunId, requestFilters)
      const mapped = mapRunArtifactToDashboard(artifact, requestFilters.locale as "en" | "ru")
      writeCachedDashboard(scope, mapped)
      if (typeof window !== "undefined") {
        localStorage.setItem(TAB_RUN_ID_KEY, mapped.runId || targetRunId)
        localStorage.setItem(LEGACY_RUN_ID_KEY, mapped.runId || targetRunId)
      }
      setState({ data: mapped, source: "api", loading: false, error: null })
      void refreshRunHistory()
    } catch (error) {
      // If the specific run was not found, fall back to the latest available run
      if (error instanceof RunNotFoundError) {
        const latestRunId = await fetchLatestRunId()
        if (latestRunId && latestRunId !== targetRunId) {
          setWarning("run_not_found")
          try {
            const fallbackArtifact = await fetchRunArtifact(latestRunId, requestFilters)
            const fallbackMapped = mapRunArtifactToDashboard(
              fallbackArtifact,
              requestFilters.locale as "en" | "ru",
            )
            const fallbackScope = buildScope(latestRunId, requestFilters)
            writeCachedDashboard(fallbackScope, fallbackMapped)
            if (typeof window !== "undefined") {
              localStorage.setItem(TAB_RUN_ID_KEY, latestRunId)
              localStorage.setItem(LEGACY_RUN_ID_KEY, latestRunId)
            }
            setState({ data: fallbackMapped, source: "api", loading: false, error: null })
            void refreshRunHistory()
            return
          } catch {
            // Fall through to cache/error handling below
          }
        }
      }

      const message = error instanceof Error ? error.message : "Failed to load dashboard data"
      const cached = typeof window !== "undefined" ? readCachedDashboard(scope) : null
      if (cached) {
        setState({
          data: { ...cached, source: "cache" },
          source: "cache",
          loading: false,
          error: `${message}. Showing cached data.`,
        })
        return
      }

      setState({
        data: buildEmptyDashboardData(),
        source: "api",
        loading: false,
        error: message,
      })
    }
  }, [requestFilters, searchRunId, refreshRunHistory])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const filteredData = useMemo(() => {
    return filterDashboardDataByDate(state.data, resolvedDateRange)
  }, [resolvedDateRange, state.data])

  const totalAnalyzedReviews = state.data.reviews.length

  return useMemo(
    () => ({
      ...state,
      data: filteredData,
      totalAnalyzedReviews,
      reload: load,
      runHistory: runHistoryState.history,
      runHistoryLoading: runHistoryState.loading,
      runHistoryError: runHistoryState.error,
      warning,
      refreshRunHistory,
    }),
    [filteredData, totalAnalyzedReviews, load, runHistoryState, warning, refreshRunHistory, state],
  )
}
