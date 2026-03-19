"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReportSseEvent, ReportSummaryPayload } from "@/lib/api-types"

export interface ReportRequest {
  store?: "google_play" | "app_store" | "yandex_games" | "vk_play"
  url: string
  country: string
  period: "7d" | "14d" | "30d" | "90d" | "custom"
  from?: string
  to?: string
  langs?: string
  source?: "direct_url" | "catalog"
  appId?: string
}

interface ReportProgressState {
  step: string
  pipeline?: "themes" | "classify"
  current?: number
  total?: number
}

export function useReport() {
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<ReportProgressState>({ step: "idle" })
  const [result, setResult] = useState<ReportSummaryPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsGenerating(false)
  }, [])

  const generate = useCallback(
    (request: ReportRequest) => {
      if (!request.url) {
        setError("Missing required URL.")
        return
      }

      stop()
      setIsGenerating(true)
      setError(null)
      setResult(null)
      setProgress({ step: "starting" })

      const query = new URLSearchParams()
      query.set("store", request.store || "google_play")
      query.set("url", request.url)
      query.set("country", request.country)
      query.set("period", request.period)
      if (request.period === "custom" && request.from && request.to) {
        query.set("from", request.from)
        query.set("to", request.to)
      }
      if (request.langs) {
        query.set("langs", request.langs)
      }
      query.set("source", request.source || "direct_url")
      if (request.appId) {
        query.set("app_id", request.appId)
      }

      const eventSource = new EventSource(`/api/report?${query.toString()}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        let parsed: ReportSseEvent
        try {
          parsed = JSON.parse(event.data) as ReportSseEvent
        } catch {
          setError("Failed to parse SSE event.")
          return
        }

        if (parsed.type === "status") {
          setProgress({ step: parsed.step })
          return
        }
        if (parsed.type === "progress") {
          setProgress({
            step: "analyzing",
            pipeline: parsed.pipeline,
            current: parsed.current,
            total: parsed.total,
          })
          return
        }
        if (parsed.type === "report") {
          setProgress({ step: "completed" })
          setResult(parsed.data)
          return
        }
        if (parsed.type === "error") {
          setError(parsed.message)
          return
        }
        if (parsed.type === "done") {
          stop()
        }
      }

      eventSource.onerror = () => {
        setError("SSE connection failed.")
        stop()
      }
    },
    [stop],
  )

  useEffect(() => stop, [stop])

  return {
    isGenerating,
    progress,
    result,
    error,
    generate,
    stop,
  }
}
