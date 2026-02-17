"use client"

import { useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ExportButton } from "@/components/search-app/export-button"
import { ProgressPanel } from "@/components/search-app/progress-panel"
import { ResultsTable } from "@/components/search-app/results-table"
import { ScanForm } from "@/components/search-app/scan-form"
import type { AppResult, ResolveResponse, ScanEvent, ScanParams } from "@/lib/lead-search/types"
import type { DatePreset } from "@/lib/date-filters"
import { listAllRegions } from "@/lib/regions"

type ScanState = "idle" | "scanning" | "done" | "error"

function resolveErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Resolve request failed"
  const detail = (payload as { detail?: string }).detail
  if (typeof detail === "string" && detail) return detail
  return "Resolve request failed"
}

export default function SearchAppPage() {
  const [state, setState] = useState<ScanState>("idle")
  const [results, setResults] = useState<AppResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [currentApp, setCurrentApp] = useState("")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [lastScanParams, setLastScanParams] = useState<ScanParams | null>(null)

  const [playInput, setPlayInput] = useState("")
  const [reportCountry, setReportCountry] = useState("us")
  const [reportPeriod, setReportPeriod] = useState<DatePreset>("14d")
  const [reportCustomFrom, setReportCustomFrom] = useState("")
  const [reportCustomTo, setReportCustomTo] = useState("")
  const [isResolving, setIsResolving] = useState(false)
  const [resolveData, setResolveData] = useState<ResolveResponse | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [selectedAppId, setSelectedAppId] = useState("")

  const regionOptions = useMemo(() => listAllRegions("en"), [])
  const regionLookup = useMemo(() => new Map(regionOptions.map((item) => [item.code, item.name])), [regionOptions])
  const normalizedReportCountry = reportCountry.trim().toLowerCase()
  const isCountryValid = regionLookup.has(normalizedReportCountry)
  const isCustomWindowValid =
    reportPeriod !== "custom"
    || (Boolean(reportCustomFrom) && Boolean(reportCustomTo) && reportCustomFrom <= reportCustomTo)

  const eventSourceRef = useRef<EventSource | null>(null)

  const handleScan = (params: ScanParams) => {
    setLastScanParams(params)
    setState("scanning")
    setResults([])
    setProgress({ current: 0, total: 0 })
    setCurrentApp("")
    setStartTime(Date.now())
    setErrors([])

    const query = new URLSearchParams()
    query.set("collection", params.collection)
    if (params.category && params.category !== "undefined") {
      query.set("category", params.category)
    }
    query.set("country", params.country)
    query.set("lang", params.lang)
    query.set("maxApps", String(params.maxApps))
    query.set("maxReviews", String(params.maxReviews))
    query.set("windowDays", String(params.windowDays))
    query.set("minAgeDays", String(params.minAgeDays))

    const source = new EventSource(`/api/scan?${query.toString()}`)
    eventSourceRef.current = source

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ScanEvent
        switch (data.type) {
          case "progress":
            setProgress({ current: data.current, total: data.total })
            setCurrentApp(`${data.title} (${data.appId})`)
            break
          case "result":
            setResults((prev) => [...prev, data.data])
            break
          case "error":
            setErrors((prev) => [...prev, data.message])
            break
          case "done":
            setState("done")
            source.close()
            break
        }
      } catch (error) {
        setErrors((prev) => [...prev, `Parse error: ${String(error)}`])
      }
    }

    source.onerror = () => {
      setState("error")
      source.close()
      setErrors((prev) => [...prev, "SSE connection error"])
    }
  }

  const stopScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState("done")
  }

  const resolveInput = async () => {
    if (!playInput.trim()) {
      setResolveError("Paste Google Play URL or package first")
      return
    }
    if (!isCountryValid) {
      setResolveError("Select a valid region code from the list.")
      return
    }
    if (!isCustomWindowValid) {
      setResolveError("Set a valid custom period: From date must be earlier than To date.")
      return
    }

    setIsResolving(true)
    setResolveError(null)
    setResolveData(null)

    try {
      const query = new URLSearchParams()
      query.set("input", playInput.trim())
      query.set("country", normalizedReportCountry)
      query.set("lang", "en")
      query.set("limit", "5")

      const response = await fetch(`/api/resolve/google-play?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as unknown
        throw new Error(resolveErrorMessage(payload))
      }

      const data = (await response.json()) as ResolveResponse
      setResolveData(data)
      setSelectedAppId(data.recommended_app_id)
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : "Resolve request failed")
    } finally {
      setIsResolving(false)
    }
  }

  const selectedCandidate = useMemo(() => {
    if (!resolveData) return null
    return resolveData.candidates.find((item) => item.app_id === selectedAppId) || resolveData.candidates[0] || null
  }, [resolveData, selectedAppId])

  const reportHref = useMemo(() => {
    if (!selectedCandidate || !isCountryValid || !isCustomWindowValid) return ""
    const query = new URLSearchParams()
    query.set("url", selectedCandidate.url)
    query.set("country", normalizedReportCountry)
    query.set("source", "direct_url")
    query.set("app_id", selectedCandidate.app_id)
    query.set("lang", "en")
    query.set("period", reportPeriod)
    if (reportPeriod === "custom" && reportCustomFrom && reportCustomTo) {
      query.set("from", reportCustomFrom)
      query.set("to", reportCustomTo)
    }
    return `/report?${query.toString()}`
  }, [isCountryValid, isCustomWindowValid, normalizedReportCountry, reportCustomFrom, reportCustomTo, reportPeriod, selectedCandidate])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-background">
      <div className="container mx-auto max-w-6xl px-4 py-10">

        {/* Hero header */}
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 shadow-md">
            <Search className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight">Review Analytics</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Generate review analytics report for any Google Play game, or scan top charts to find games with low developer reply rates.
          </p>
        </header>

        <div className="space-y-8">

          {/* Primary CTA — Generate Report */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-400" />
            <h2 className="mb-1 text-lg font-bold tracking-tight">Generate Report</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Paste a Google Play URL or search query to analyze reviews
            </p>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px_160px_auto]">
              <Input
                value={playInput}
                onChange={(event) => setPlayInput(event.target.value)}
                placeholder="https://play.google.com/store/search?q=pirate+ships&c=apps"
                className="h-11"
              />

              <div className="space-y-1">
                <Input
                  list="report-country-options"
                  value={reportCountry}
                  onChange={(event) => setReportCountry(event.target.value.toLowerCase())}
                  placeholder="Region (e.g. us)"
                  className={`h-11 ${!isCountryValid && reportCountry ? "border-destructive" : ""}`}
                />
                <datalist id="report-country-options">
                  {regionOptions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.name}
                    </option>
                  ))}
                </datalist>
                {!isCountryValid && reportCountry ? (
                  <p className="text-xs text-destructive">Choose a valid region from the dropdown list.</p>
                ) : null}
              </div>

              <Select value={reportPeriod} onValueChange={(value) => setReportPeriod(value as DatePreset)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="14d">Last 14 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={resolveInput}
                disabled={isResolving}
                className="h-11 bg-amber-500 font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                {isResolving ? "Resolving..." : "Resolve"}
              </Button>
            </div>

            {reportPeriod === "custom" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  value={reportCustomFrom}
                  onChange={(event) => setReportCustomFrom(event.target.value)}
                />
                <Input
                  type="date"
                  value={reportCustomTo}
                  onChange={(event) => setReportCustomTo(event.target.value)}
                />
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Google Play Store URLs only · Up to 1,000 newest reviews from the selected period and region
            </p>

            {resolveError && <p className="mt-3 text-sm text-destructive">{resolveError}</p>}

            {resolveData && (
              <div className="mt-5 space-y-3 rounded-xl border bg-slate-50/60 p-5">
                <p className="text-sm font-semibold">Select app</p>
                <div className="space-y-2">
                  {resolveData.candidates.map((candidate) => (
                    <label
                      key={candidate.app_id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                        selectedAppId === candidate.app_id
                          ? "border-amber-300 bg-amber-50/50"
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="resolve-candidate"
                          value={candidate.app_id}
                          checked={selectedAppId === candidate.app_id}
                          onChange={() => setSelectedAppId(candidate.app_id)}
                          className="accent-amber-500"
                        />
                        <div>
                          <div className="font-semibold">{candidate.title}</div>
                          <div className="text-xs text-muted-foreground">{candidate.app_id}</div>
                        </div>
                      </div>
                      {candidate.is_top1 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          top-1
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    asChild
                    className="bg-amber-500 font-semibold text-white shadow-sm hover:bg-amber-600"
                    disabled={!reportHref}
                  >
                    <a href={reportHref || "#"} target="_blank" rel="noopener noreferrer">
                      Generate Report
                    </a>
                  </Button>
                  {selectedCandidate && (
                    <a
                      href={selectedCandidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-amber-700 hover:underline"
                    >
                      Open in Google Play
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Secondary — Bulk Scan */}
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold tracking-tight">Bulk Scan</h2>
              <p className="text-sm text-muted-foreground">
                Scan Google Play top charts to find games with low developer reply rates
              </p>
            </div>
            <ScanForm onSubmit={handleScan} isScanning={state === "scanning"} />
          </div>

          {state === "scanning" && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Scanning...</h2>
                <button onClick={stopScan} className="text-sm font-medium text-destructive hover:underline">
                  Stop Scan
                </button>
              </div>
              <ProgressPanel current={progress.current} total={progress.total} currentApp={currentApp} startTime={startTime} />
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <h3 className="mb-2 font-semibold text-destructive">Errors ({errors.length})</h3>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                {errors.map((error, index) => (
                  <li key={`${index}-${error}`} className="text-muted-foreground">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Results ({results.length})</h2>
                <ExportButton results={results} />
              </div>
              <ResultsTable
                results={results}
                scanParams={lastScanParams}
                reportCountry={normalizedReportCountry}
                reportPeriod={reportPeriod}
                reportCustomFrom={reportCustomFrom}
                reportCustomTo={reportCustomTo}
                canGenerateReports={isCountryValid && isCustomWindowValid}
              />
            </div>
          )}

          {state === "idle" && results.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Configure scan parameters above and click Start Scan, or paste a URL to generate a report.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
