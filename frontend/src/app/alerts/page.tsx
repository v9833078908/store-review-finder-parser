"use client"

import { AlertList } from "@/components/alerts/alert-list"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

export default function AlertsPage() {
  const { data, loading, error } = useDashboardData()
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{text.pages.alertsTitle}</h1>
        <p className="text-muted-foreground">{text.pages.alertsSubtitle}</p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">{text.common.loadingAlerts}</div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <AlertList alerts={data.alerts} />
    </div>
  )
}
