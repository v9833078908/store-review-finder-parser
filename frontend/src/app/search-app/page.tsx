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
import { apiPath, withBasePath } from "@/lib/base-path"

type ScanState = "idle" | "scanning" | "done" | "error"
type ReportStore = "google_play" | "app_store" | "yandex_games" | "vk_play" | "steam"
type CombinedStoreConfig = {
  url: string
  country?: string
  period: DatePreset
  from: string
  to: string
  langs?: string
}
const YANDEX_GAMES_URL_RE = /^https:\/\/yandex\.ru\/games\/app\/(\d+)(?:[/?#].*)?$/i
const VK_PLAY_URL_RE = /^https:\/\/vkplay\.ru\/play\/game\/([^/?#]+)(?:[/?#].*)?$/i
const STEAM_URL_RE = /^https:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/[^?#]*)?(?:[?#].*)?$/i
const COMBINED_STORE_OPTIONS: ReportStore[] = ["google_play", "app_store", "yandex_games", "vk_play", "steam"]

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

  const [reportStore, setReportStore] = useState<ReportStore>("google_play")
  const [playInput, setPlayInput] = useState("")
  const [reportCountry, setReportCountry] = useState("us")
  const [reportPeriod, setReportPeriod] = useState<DatePreset>("14d")
  const [reportLangs, setReportLangs] = useState("ru")
  const [reportCustomFrom, setReportCustomFrom] = useState("")
  const [reportCustomTo, setReportCustomTo] = useState("")
  const [isResolving, setIsResolving] = useState(false)
  const [resolveData, setResolveData] = useState<ResolveResponse | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [selectedAppId, setSelectedAppId] = useState("")
  const [combinedStores, setCombinedStores] = useState<ReportStore[]>(["google_play", "yandex_games"])
  const [combinedConfigs, setCombinedConfigs] = useState<Record<ReportStore, CombinedStoreConfig>>({
    google_play: { url: "", country: "us", period: "14d", from: "", to: "", langs: "en,ru" },
    app_store: { url: "", country: "us", period: "14d", from: "", to: "" },
    yandex_games: { url: "", period: "14d", from: "", to: "" },
    vk_play: { url: "", period: "14d", from: "", to: "", langs: "ru" },
    steam: { url: "", period: "14d", from: "", to: "", langs: "ru" },
  })

  const regionOptions = useMemo(() => listAllRegions("en"), [])
  const regionLookup = useMemo(() => new Map(regionOptions.map((item) => [item.code, item.name])), [regionOptions])
  const normalizedReportCountry = reportCountry.trim().toLowerCase()
  const isCountryValid = regionLookup.has(normalizedReportCountry)
  const isCustomWindowValid =
    reportPeriod !== "custom"
    || (Boolean(reportCustomFrom) && Boolean(reportCustomTo) && reportCustomFrom <= reportCustomTo)

  const eventSourceRef = useRef<EventSource | null>(null)

  const updateCombinedConfig = (store: ReportStore, patch: Partial<CombinedStoreConfig>) => {
    setCombinedConfigs((current) => ({
      ...current,
      [store]: {
        ...current[store],
        ...patch,
      },
    }))
  }

  const toggleCombinedStore = (store: ReportStore) => {
    setCombinedStores((current) => {
      if (current.includes(store)) {
        return current.filter((item) => item !== store)
      }
      return [...current, store]
    })
  }

  const combinedReportHref = useMemo(() => {
    try {
      if (!combinedStores.length) return ""
      const sources = combinedStores.map((store) => {
        const config = combinedConfigs[store]
        const trimmedUrl = config.url.trim()
        if (!trimmedUrl) {
          throw new Error(`Missing input for ${store}`)
        }
        if (config.period === "custom" && (!config.from || !config.to || config.from > config.to)) {
          throw new Error(`Invalid custom period for ${store}`)
        }
        if ((store === "google_play" || store === "app_store") && !config.country?.trim()) {
          throw new Error(`Missing country for ${store}`)
        }
        if (store === "app_store" && !/^\d+$/.test(trimmedUrl)) {
          throw new Error("App Store input must be a numeric app_id.")
        }
        if (store === "yandex_games" && !YANDEX_GAMES_URL_RE.test(trimmedUrl)) {
          throw new Error("Yandex Games input must be a direct game URL.")
        }
        if (store === "vk_play" && !VK_PLAY_URL_RE.test(trimmedUrl)) {
          throw new Error("VK Play input must be a direct game URL.")
        }
        if (store === "steam" && !STEAM_URL_RE.test(trimmedUrl)) {
          throw new Error("Steam input must be a direct game URL.")
        }

        const payload: Record<string, string> = {
          store,
          url: trimmedUrl,
          period: config.period,
        }
        if (store === "app_store") {
          payload.app_id = trimmedUrl
          payload.url = `https://apps.apple.com/app/id${trimmedUrl}`
        }
        if (store === "google_play" || store === "app_store") {
          payload.country = String(config.country || "us").trim().toLowerCase()
        } else {
          payload.country = "ru"
        }
        if (store === "google_play" || store === "vk_play" || store === "steam") {
          payload.langs = String(config.langs || (store === "google_play" ? "en,ru" : "ru")).trim()
        }
        if (config.period === "custom") {
          payload.from = config.from
          payload.to = config.to
        }
        return payload
      })

      const query = new URLSearchParams()
      query.set("store", "multi_source")
      query.set("sources", JSON.stringify(sources))
      return `/report?${query.toString()}`
    } catch {
      return ""
    }
  }, [combinedConfigs, combinedStores])

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

  const buildYandexGamesResolveData = (inputUrl: string): ResolveResponse => {
    const normalizedUrl = inputUrl.trim()
    const match = YANDEX_GAMES_URL_RE.exec(normalizedUrl)
    const appId = match?.[1]
    if (!appId) {
      throw new Error("Yandex Games input must be a direct game URL like https://yandex.ru/games/app/423744")
    }
    return {
      input_type: "details_url",
      recommended_app_id: appId,
      candidates: [
        {
          app_id: appId,
          title: `Yandex Games app ${appId}`,
          url: normalizedUrl,
          is_top1: true,
        },
      ],
    }
  }

  const buildVkPlayResolveData = (inputUrl: string): ResolveResponse => {
    const normalizedUrl = inputUrl.trim()
    const match = VK_PLAY_URL_RE.exec(normalizedUrl)
    const slug = match?.[1]
    if (!slug) {
      throw new Error("VK Play input must be a direct game URL like https://vkplay.ru/play/game/pirate-ships-46035")
    }
    return {
      input_type: "details_url",
      recommended_app_id: slug,
      candidates: [
        {
          app_id: slug,
          title: `VK Play game ${slug}`,
          url: normalizedUrl,
          is_top1: true,
        },
      ],
    }
  }

  const buildSteamResolveData = (inputUrl: string): ResolveResponse => {
    const normalizedUrl = inputUrl.trim()
    const match = STEAM_URL_RE.exec(normalizedUrl)
    const appId = match?.[1]
    if (!appId) {
      throw new Error("Steam input must be a direct game URL like https://store.steampowered.com/app/4011110/Pirate_Ships/")
    }
    return {
      input_type: "details_url",
      recommended_app_id: appId,
      candidates: [
        {
          app_id: appId,
          title: `Steam app ${appId}`,
          url: normalizedUrl,
          is_top1: true,
        },
      ],
    }
  }

  const resolveInput = async () => {
    if (!playInput.trim()) {
      setResolveError(
        reportStore === "app_store"
          ? "Enter App Store numeric app_id first"
          : reportStore === "yandex_games"
            ? "Paste a direct Yandex Games URL first"
            : reportStore === "vk_play"
              ? "Paste a direct VK Play game URL first"
              : reportStore === "steam"
                ? "Paste a direct Steam game URL first"
            : "Paste Google Play URL or package first",
      )
      return
    }
    if (reportStore === "app_store" && !/^\d+$/.test(playInput.trim())) {
      setResolveError("App Store input must be a numeric app_id.")
      return
    }
    if (!usesYandexGamesFlow && !isCountryValid) {
      setResolveError("Select a valid region code from the list.")
      return
    }
    if (!usesYandexGamesFlow && !isCustomWindowValid) {
      setResolveError("Set a valid custom period: From date must be earlier than To date.")
      return
    }

    setIsResolving(true)
    setResolveError(null)
    setResolveData(null)

    try {
      if (reportStore === "yandex_games") {
        const data = buildYandexGamesResolveData(playInput)
        setResolveData(data)
        setSelectedAppId(data.recommended_app_id)
        return
      }
      if (reportStore === "vk_play") {
        const data = buildVkPlayResolveData(playInput)
        setResolveData(data)
        setSelectedAppId(data.recommended_app_id)
        return
      }
      if (reportStore === "steam") {
        const data = buildSteamResolveData(playInput)
        setResolveData(data)
        setSelectedAppId(data.recommended_app_id)
        return
      }

      const query = new URLSearchParams()
      query.set("country", normalizedReportCountry)
      if (reportStore === "app_store") {
        query.set("app_id", playInput.trim())
      } else {
        query.set("input", playInput.trim())
        query.set("lang", "en")
        query.set("limit", "5")
      }

      const endpoint = reportStore === "app_store" ? apiPath("/api/resolve/app-store") : apiPath("/api/resolve/google-play")
      const response = await fetch(`${endpoint}?${query.toString()}`, {
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
  const usesYandexGamesFlow = reportStore === "yandex_games"
  const usesVkPlayFlow = reportStore === "vk_play"
  const usesSteamFlow = reportStore === "steam"
  const usesDirectUrlFlow = usesYandexGamesFlow || usesVkPlayFlow || usesSteamFlow

  const reportHref = useMemo(() => {
    if (!selectedCandidate) return ""
    if (!usesDirectUrlFlow && (!isCountryValid || !isCustomWindowValid)) return ""
    if (usesYandexGamesFlow && !isCustomWindowValid) return ""
    if ((usesVkPlayFlow || usesSteamFlow) && !reportLangs.trim()) return ""
    const query = new URLSearchParams()
    query.set("url", selectedCandidate.url)
    query.set("store", reportStore)
    query.set("country", usesDirectUrlFlow ? "ru" : normalizedReportCountry)
    query.set("source", "direct_url")
    query.set("app_id", selectedCandidate.app_id)
    query.set("lang", usesVkPlayFlow || usesSteamFlow ? reportLangs.trim() : "en")
    if (usesVkPlayFlow || usesSteamFlow) {
      query.set("langs", reportLangs.trim())
    }
    query.set("period", reportPeriod)
    if (reportPeriod === "custom" && reportCustomFrom && reportCustomTo) {
      query.set("from", reportCustomFrom)
      query.set("to", reportCustomTo)
    }
    return withBasePath(`/report?${query.toString()}`)
  }, [isCountryValid, isCustomWindowValid, normalizedReportCountry, reportCustomFrom, reportCustomTo, reportLangs, reportPeriod, reportStore, selectedCandidate, usesDirectUrlFlow, usesSteamFlow, usesVkPlayFlow, usesYandexGamesFlow])

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
            Generate review analytics report for Google Play, App Store, Yandex Games, VK Play, or Steam titles, or scan Google Play top charts to find games with low developer reply rates.
          </p>
        </header>

        <div className="space-y-8">

          {/* Primary CTA — Generate Report */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-400" />
            <h2 className="mb-1 text-lg font-bold tracking-tight">Generate Report</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {reportStore === "app_store"
                ? "Enter a numeric App Store app_id to analyze reviews"
                : reportStore === "yandex_games"
                  ? "Paste a direct Yandex Games app URL to analyze reviews"
                  : reportStore === "vk_play"
                    ? "Paste a direct VK Play game URL to analyze reviews"
                    : reportStore === "steam"
                      ? "Paste a direct Steam game URL to analyze reviews"
                  : "Paste a Google Play URL or search query to analyze reviews"}
            </p>

            <div className="mb-3 grid grid-cols-1 gap-3 sm:max-w-[220px]">
              <Select
                value={reportStore}
                onValueChange={(value) => {
                  const nextStore = value as ReportStore
                  setReportStore(nextStore)
                  if ((nextStore === "yandex_games" || nextStore === "vk_play" || nextStore === "steam") && (!reportCountry.trim() || reportCountry.trim().toLowerCase() === "us")) {
                    setReportCountry("ru")
                  }
                  if ((nextStore === "vk_play" || nextStore === "steam") && !reportLangs.trim()) {
                    setReportLangs("ru")
                  }
                  setResolveData(null)
                  setResolveError(null)
                  setSelectedAppId("")
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_play">Google Play</SelectItem>
                  <SelectItem value="app_store">App Store</SelectItem>
                  <SelectItem value="yandex_games">Yandex Games</SelectItem>
                  <SelectItem value="vk_play">VK Play</SelectItem>
                  <SelectItem value="steam">Steam</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${usesYandexGamesFlow ? "xl:grid-cols-[1fr_160px_auto]" : usesVkPlayFlow || usesSteamFlow ? "xl:grid-cols-[1fr_120px_160px_auto]" : "xl:grid-cols-[1fr_220px_160px_auto]"}`}>
              <Input
                value={playInput}
                onChange={(event) => setPlayInput(event.target.value)}
                placeholder={
                  reportStore === "app_store"
                    ? "123456789"
                    : reportStore === "yandex_games"
                      ? "https://yandex.ru/games/app/423744"
                      : reportStore === "vk_play"
                        ? "https://vkplay.ru/play/game/pirate-ships-46035"
                        : reportStore === "steam"
                          ? "https://store.steampowered.com/app/4011110/Pirate_Ships/"
                      : "https://play.google.com/store/search?q=pirate+ships&c=apps"
                }
                className="h-11"
              />

              {!usesDirectUrlFlow && (
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
              )}

              {(usesVkPlayFlow || usesSteamFlow) && (
                <Input
                  value={reportLangs}
                  onChange={(event) => setReportLangs(event.target.value.toLowerCase())}
                  placeholder="Lang (e.g. ru)"
                  className="h-11"
                />
              )}

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
                {isResolving ? "Resolving..." : usesDirectUrlFlow ? "Validate URL" : "Resolve"}
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
              {reportStore === "app_store"
                ? "Numeric App Store app_id only · Up to 500 newest reviews from the selected period and region"
                : reportStore === "yandex_games"
                  ? "Direct Yandex Games URLs only · The scraper fetches the available feed and keeps reviews only for the selected period"
                  : reportStore === "vk_play"
                    ? "Direct VK Play URLs only · The scraper uses the selected language and selected date window"
                    : reportStore === "steam"
                      ? "Direct Steam URLs only · The scraper uses the selected language and selected date window"
                  : "Google Play Store URLs only · Up to 1,000 newest reviews from the selected period and region"}
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
                      {reportStore === "app_store"
                        ? "Open in App Store"
                        : reportStore === "yandex_games"
                          ? "Open in Yandex Games"
                          : reportStore === "vk_play"
                            ? "Open in VK Play"
                            : reportStore === "steam"
                              ? "Open in Steam"
                          : "Open in Google Play"}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h2 className="mb-1 text-lg font-bold tracking-tight">Generate Combined Report</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Select multiple stores, provide one source input per store, and build a single aggregated report.
            </p>

            <div className="mb-5 flex flex-wrap gap-3">
              {COMBINED_STORE_OPTIONS.map((store) => {
                const checked = combinedStores.includes(store)
                return (
                  <label
                    key={store}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked ? "border-amber-300 bg-amber-50/60" : "hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCombinedStore(store)}
                      className="accent-amber-500"
                    />
                    <span>
                      {store === "google_play"
                        ? "Google Play"
                        : store === "app_store"
                          ? "App Store"
                          : store === "yandex_games"
                            ? "Yandex Games"
                            : store === "vk_play"
                              ? "VK Play"
                              : "Steam"}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="space-y-4">
              {combinedStores.map((store) => {
                const config = combinedConfigs[store]
                return (
                  <div key={store} className="rounded-xl border bg-slate-50/50 p-4">
                    <div className="mb-3 text-sm font-semibold">
                      {store === "google_play"
                        ? "Google Play"
                        : store === "app_store"
                          ? "App Store"
                          : store === "yandex_games"
                            ? "Yandex Games"
                            : store === "vk_play"
                              ? "VK Play"
                              : "Steam"}
                    </div>
                    <div className={`grid grid-cols-1 gap-3 ${store === "google_play" ? "xl:grid-cols-[1fr_140px_160px]" : store === "app_store" ? "xl:grid-cols-[1fr_140px_160px]" : store === "vk_play" || store === "steam" ? "xl:grid-cols-[1fr_120px_160px]" : "xl:grid-cols-[1fr_160px]"}`}>
                      <Input
                        value={config.url}
                        onChange={(event) => updateCombinedConfig(store, { url: event.target.value })}
                        placeholder={
                          store === "google_play"
                            ? "https://play.google.com/store/apps/details?id=com.example"
                            : store === "app_store"
                              ? "123456789"
                              : store === "yandex_games"
                                ? "https://yandex.ru/games/app/423744"
                                : store === "vk_play"
                                  ? "https://vkplay.ru/play/game/pirate-ships-46035"
                                  : "https://store.steampowered.com/app/4011110/Pirate_Ships/"
                        }
                        className="h-11"
                      />

                      {(store === "google_play" || store === "app_store") && (
                        <Input
                          list="report-country-options"
                          value={config.country || "us"}
                          onChange={(event) => updateCombinedConfig(store, { country: event.target.value.toLowerCase() })}
                          placeholder="Region"
                          className="h-11"
                        />
                      )}

                      {(store === "vk_play" || store === "steam") && (
                        <Input
                          value={config.langs || "ru"}
                          onChange={(event) => updateCombinedConfig(store, { langs: event.target.value.toLowerCase() })}
                          placeholder="Lang (e.g. ru)"
                          className="h-11"
                        />
                      )}

                      <Select value={config.period} onValueChange={(value) => updateCombinedConfig(store, { period: value as DatePreset })}>
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
                    </div>

                    {config.period === "custom" && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          type="date"
                          value={config.from}
                          onChange={(event) => updateCombinedConfig(store, { from: event.target.value })}
                        />
                        <Input
                          type="date"
                          value={config.to}
                          onChange={(event) => updateCombinedConfig(store, { to: event.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-5">
              <Button
                asChild
                className="bg-amber-500 font-semibold text-white shadow-sm hover:bg-amber-600"
                disabled={!combinedReportHref}
              >
                <a href={combinedReportHref || "#"} target="_blank" rel="noopener noreferrer">
                  Generate Combined Report
                </a>
              </Button>
            </div>
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
