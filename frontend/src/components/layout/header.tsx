"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Clock, RefreshCw } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import {
  filtersEqual,
  formatRangeLabel,
  isCustomRangeValid,
  type DateFilterState,
  type DatePreset,
} from "@/lib/date-filters"
import { formatDateTime } from "@/lib/utils"
import { getUiText } from "@/lib/i18n"
import type { RunHistoryItem } from "@/lib/api-types"

const DATE_PRESETS: DatePreset[] = ["24h", "7d", "14d", "30d", "90d", "custom"]

function formatRunLabel(item: RunHistoryItem, locale: string): string {
  const datePart = item.saved_at ? formatDateTime(item.saved_at, locale as "en" | "ru") : "—"
  const shortId = item.run_id.slice(0, 7)
  const reviewsPart = item.reviews_selected != null
    ? `${item.reviews_selected} ${locale === "ru" ? "отз." : "rev."}`
    : ""
  return [item.app_name, reviewsPart, datePart, shortId].filter(Boolean).join(" · ")
}

function DashboardHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data, totalAnalyzedReviews, runHistory, runHistoryLoading, warning, refreshRunHistory } = useDashboardData()
  const {
    locale,
    setLocale,
    dateFilter,
    applyDateFilter,
    resetDateFilter,
    resolvedDateRange,
  } = useDashboardPreferences()
  const text = getUiText(locale)
  const lastUpdated = data.lastUpdated

  const [draftFilter, setDraftFilter] = useState<DateFilterState>(dateFilter)

  useEffect(() => {
    setDraftFilter(dateFilter)
  }, [dateFilter])

  const isDraftCustom = draftFilter.preset === "custom"
  const hasChanges = !filtersEqual(draftFilter, dateFilter)
  const customRangeValid = isCustomRangeValid(draftFilter)
  const canApply = hasChanges && (!isDraftCustom || customRangeValid)

  const activeRangeLabel = useMemo(
    () =>
      formatRangeLabel(
        dateFilter,
        locale,
        {
          "24h": text.datePresets["24h"],
          "7d": text.datePresets["7d"],
          "14d": text.datePresets["14d"],
          "30d": text.datePresets["30d"],
          "90d": text.datePresets["90d"],
          custom: text.datePresets.custom,
        },
        resolvedDateRange,
      ),
    [dateFilter, locale, resolvedDateRange, text.datePresets],
  )

  const currentRunId = searchParams.get("run_id") ?? data.runId ?? ""

  const handleRunSelect = (runId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("run_id", runId)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleRefreshRuns = () => {
    void refreshRunHistory()
  }

  const applyDraftFilter = () => {
    if (!canApply) return
    applyDateFilter(draftFilter)
  }

  const updatePreset = (preset: DatePreset) => {
    setDraftFilter((current) => {
      if (preset === "custom") {
        return {
          preset,
          customFrom: current.customFrom,
          customTo: current.customTo,
        }
      }

      return {
        preset,
        customFrom: "",
        customTo: "",
      }
    })
  }

  const warningMessage = warning === "run_not_found" ? text.header.runNotFoundFallback : null

  return (
    <header className="sticky top-0 z-10 border-b bg-background px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <SidebarTrigger />

        {/* Run history switcher */}
        <Select
          value={currentRunId || undefined}
          onValueChange={handleRunSelect}
          disabled={runHistory.length === 0}
        >
          <SelectTrigger className="w-[340px] max-w-full">
            <SelectValue
              placeholder={
                runHistoryLoading
                  ? "..."
                  : runHistory.length === 0
                    ? text.header.noRuns
                    : text.header.selectRun
              }
            />
          </SelectTrigger>
          <SelectContent>
            {runHistory.map((item) => (
              <SelectItem key={item.run_id} value={item.run_id}>
                {formatRunLabel(item, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleRefreshRuns}
          disabled={runHistoryLoading}
          title={text.header.refreshRuns}
        >
          <RefreshCw className={`h-4 w-4 ${runHistoryLoading ? "animate-spin" : ""}`} />
        </Button>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center rounded-md border bg-muted/20 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={locale === "en" ? "secondary" : "ghost"}
              onClick={() => setLocale("en")}
            >
              EN
            </Button>
            <Button
              type="button"
              size="sm"
              variant={locale === "ru" ? "secondary" : "ghost"}
              onClick={() => setLocale("ru")}
            >
              RU
            </Button>
          </div>

          <Select value={draftFilter.preset} onValueChange={(value) => updatePreset(value as DatePreset)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={text.header.dateRange} />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {text.datePresets[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isDraftCustom && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{text.header.from}</span>
                <Input
                  type="date"
                  value={draftFilter.customFrom}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      customFrom: event.target.value,
                    }))
                  }
                  className="h-8 w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{text.header.to}</span>
                <Input
                  type="date"
                  value={draftFilter.customTo}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      customTo: event.target.value,
                    }))
                  }
                  className="h-8 w-[150px]"
                />
              </div>
            </>
          )}

          <Button size="sm" onClick={applyDraftFilter} disabled={!canApply}>
            {text.header.apply}
          </Button>
          <Button size="sm" variant="outline" onClick={resetDateFilter}>
            {text.header.reset}
          </Button>

          <Badge variant="outline" className="whitespace-nowrap">
            {text.header.activeRange}: {activeRangeLabel} · {totalAnalyzedReviews} {text.header.reviewsSuffix} · {text.header.timezone} (MSK)
          </Badge>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {text.header.updated} {formatDateTime(lastUpdated, locale)}
            </span>
          </div>
        </div>
      </div>

      {isDraftCustom && !customRangeValid && (
        <p className="mt-2 text-xs text-destructive">{text.header.invalidRange}</p>
      )}

      {warningMessage && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{warningMessage}</p>
      )}
    </header>
  )
}

export function Header() {
  const pathname = usePathname()
  if (pathname.startsWith("/search-app")) {
    return null
  }
  return <DashboardHeader />
}
