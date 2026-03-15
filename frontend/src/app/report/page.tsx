"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useReport } from "@/hooks/use-report"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

const ACTIVE_RUN_ID_KEY = "review-dashboard:active-run-id:tab:v1"
const LAST_RUN_ID_KEY = "review-dashboard:run-id:v1"
const LAST_RUN_CONTEXT_KEY = "review-dashboard:last-report-context:v1"

export default function ReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasStartedRef = useRef(false)
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  const request = useMemo(
    () => ({
      store: (searchParams.get("store") as "google_play" | "app_store" | null) || "google_play",
      url: searchParams.get("url") || "",
      country: searchParams.get("country") || "",
      period:
        (searchParams.get("period") as "7d" | "14d" | "30d" | "90d" | "custom" | null) || "14d",
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      source: (searchParams.get("source") as "direct_url" | "catalog" | null) || "direct_url",
      appId: searchParams.get("app_id") || undefined,
    }),
    [searchParams],
  )

  const { isGenerating, progress, result, error, generate } = useReport()

  useEffect(() => {
    if (hasStartedRef.current) return
    if (!request.url) return
    hasStartedRef.current = true
    generate(request)
  }, [generate, request])

  useEffect(() => {
    if (!result?.run_id) return
    const targetLang = searchParams.get("lang") || locale || "en"
    const targetPeriod = searchParams.get("period") || "14d"
    const targetFrom = searchParams.get("from")
    const targetTo = searchParams.get("to")

    try {
      sessionStorage.setItem(ACTIVE_RUN_ID_KEY, result.run_id)
      localStorage.setItem(LAST_RUN_ID_KEY, result.run_id)
      localStorage.setItem(
        LAST_RUN_CONTEXT_KEY,
        JSON.stringify({
          run_id: result.run_id,
          lang: targetLang,
          period: targetPeriod,
        }),
      )
    } catch {
      // Ignore localStorage write errors.
    }
    const params = new URLSearchParams()
    params.set("lang", targetLang)
    params.set("period", targetPeriod)
    params.set("run_id", result.run_id)
    if (targetPeriod === "custom" && targetFrom && targetTo) {
      params.set("from", targetFrom)
      params.set("to", targetTo)
    }
    router.replace(`/command-center?${params.toString()}`)
  }, [locale, result, router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{text.pages.reportTitle}</CardTitle>
          <CardDescription>{text.pages.reportSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!request.url && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {text.pages.reportMissingUrl}
            </div>
          )}

          {request.url && (
            <>
              <div className="rounded-md border p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{text.pages.reportStep}:</span>{" "}
                  <span className="font-medium">{progress.step}</span>
                </div>
                {progress.pipeline && (
                  <div>
                    <span className="text-muted-foreground">{text.pages.reportPipeline}:</span>{" "}
                    <span className="font-medium">{progress.pipeline}</span>
                    {progress.current !== undefined && progress.total !== undefined && (
                      <span className="text-muted-foreground"> ({progress.current}/{progress.total})</span>
                    )}
                  </div>
                )}
              </div>

              {isGenerating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {text.pages.reportProcessing}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <div className="text-sm text-destructive">{error}</div>
              <Button
                variant="outline"
                onClick={() => generate(request)}
                disabled={!request.url}
              >
                {text.pages.reportRetry}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
