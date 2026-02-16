import type { DashboardData } from "@/lib/dashboard-types"
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
    markdown: "",
    lastUpdated: new Date().toISOString(),
    source: "mock",
  }

  return localizeMockDashboardData(base, locale)
}
