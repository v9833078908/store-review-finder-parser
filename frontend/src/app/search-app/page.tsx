"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExportButton } from "@/components/search-app/export-button"
import { ProgressPanel } from "@/components/search-app/progress-panel"
import { ResultsTable } from "@/components/search-app/results-table"
import { ScanForm } from "@/components/search-app/scan-form"
import type { AppResult, ResolveResponse, ScanEvent, ScanParams } from "@/lib/lead-search/types"

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
  const [reportLang, setReportLang] = useState("en")
  const [reportMaxReviews, setReportMaxReviews] = useState(300)
  const [isResolving, setIsResolving] = useState(false)
  const [resolveData, setResolveData] = useState<ResolveResponse | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [selectedAppId, setSelectedAppId] = useState("")

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

    setIsResolving(true)
    setResolveError(null)
    setResolveData(null)

    try {
      const query = new URLSearchParams()
      query.set("input", playInput.trim())
      query.set("country", reportCountry)
      query.set("lang", reportLang)
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
    if (!selectedCandidate) return ""
    const query = new URLSearchParams()
    query.set("url", selectedCandidate.url)
    query.set("country", reportCountry)
    query.set("langs", reportLang)
    query.set("maxReviews", String(reportMaxReviews || 300))
    query.set("source", "direct_url")
    query.set("app_id", selectedCandidate.app_id)
    query.set("lang", reportLang || "en")
    query.set("period", "7d")
    return `/report?${query.toString()}`
  }, [selectedCandidate, reportCountry, reportLang, reportMaxReviews])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">Lead Finder</h1>
          <p className="text-muted-foreground">
            Find games with low developer reply rates on Google Play, then generate review analytics report for any selected game.
          </p>
        </header>

        <div className="space-y-8">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-xl font-semibold">Generate Report By URL</h2>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_100px_100px_140px_auto]">
              <Input
                value={playInput}
                onChange={(event) => setPlayInput(event.target.value)}
                placeholder="https://play.google.com/store/search?q=pirate+ships&c=apps&hl=en&gl=us"
              />
              <Input value={reportCountry} onChange={(event) => setReportCountry(event.target.value.toLowerCase())} />
              <Input value={reportLang} onChange={(event) => setReportLang(event.target.value.toLowerCase())} />
              <Input
                type="number"
                min={10}
                max={1000}
                value={reportMaxReviews}
                onChange={(event) => setReportMaxReviews(Number(event.target.value || 300))}
              />
              <Button onClick={resolveInput} disabled={isResolving}>
                {isResolving ? "Resolving..." : "Resolve"}
              </Button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">Only Google Play Store URLs are supported.</p>

            {resolveError && <p className="mt-3 text-sm text-destructive">{resolveError}</p>}

            {resolveData && (
              <div className="mt-4 space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Candidate selection (auto top-1, you can switch)</p>
                <div className="space-y-2">
                  {resolveData.candidates.map((candidate) => (
                    <label key={candidate.app_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="resolve-candidate"
                          value={candidate.app_id}
                          checked={selectedAppId === candidate.app_id}
                          onChange={() => setSelectedAppId(candidate.app_id)}
                        />
                        <div>
                          <div className="font-medium">{candidate.title}</div>
                          <div className="text-xs text-muted-foreground">{candidate.app_id}</div>
                        </div>
                      </div>
                      {candidate.is_top1 ? <span className="text-xs text-muted-foreground">top-1</span> : null}
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild disabled={!reportHref}>
                    <a href={reportHref || "#"} target="_blank" rel="noopener noreferrer">
                      Сформировать отчет
                    </a>
                  </Button>
                  {selectedCandidate && (
                    <a
                      href={selectedCandidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Open selected app in Google Play
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-xl font-semibold">Scan Parameters</h2>
            <ScanForm onSubmit={handleScan} isScanning={state === "scanning"} />
          </div>

          {state === "scanning" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Scanning...</h2>
                <button onClick={stopScan} className="text-sm text-destructive hover:underline">
                  Stop Scan
                </button>
              </div>
              <ProgressPanel current={progress.current} total={progress.total} currentApp={currentApp} startTime={startTime} />
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border bg-destructive/10 p-4">
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
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Results ({results.length})</h2>
                <ExportButton results={results} />
              </div>
              <ResultsTable results={results} scanParams={lastScanParams} />
            </div>
          )}

          {state === "idle" && results.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p>Configure your scan parameters and click Start Scan to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
