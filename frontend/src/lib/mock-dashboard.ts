import type { DashboardData } from "@/lib/dashboard-types"
import { buildEmptyReportLayers } from "@/lib/dashboard-types"
import {
  actionItems,
  alerts,
  clusters,
  issueStats,
  product,
  reputationStats,
  responseStats,
  reviews,
  timelineData,
} from "@/lib/mock-data"
import type { SupportedLocale } from "@/lib/i18n"
import { localizeMockDashboardData } from "@/lib/mock-localization"

export function buildMockDashboardData(locale: SupportedLocale): DashboardData {
  const reportLayers = buildEmptyReportLayers()
  reportLayers.summary.narrative = "Mock summary layer for unified report."
  reportLayers.signals.narrative = "Mock signals layer with sample alert interpretation."
  reportLayers.issues.narrative = "Mock issues layer with top clusters."
  reportLayers.actions.narrative = "Mock actions layer with suggested follow-ups."

  const base: DashboardData = {
    runId: null,
    appName: product.name,
    packageName: product.packageId,
    product,
    reputationStats,
    issueStats,
    responseStats,
    timelineData,
    reviews,
    clusters,
    alerts,
    actionItems,
    reportLayers,
    markdown: "",
    lastUpdated: new Date().toISOString(),
    source: "mock",
  }

  return localizeMockDashboardData(base, locale)
}
