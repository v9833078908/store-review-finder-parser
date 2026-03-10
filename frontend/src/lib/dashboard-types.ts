import type {
  ActionItem,
  Alert,
  Cluster,
  CommunityPulseStats,
  CommunityThread,
  IssueStats,
  Product,
  ReputationStats,
  ResponseStats,
  Review,
  SourceComparisonStats,
  TimelinePoint,
} from "@/lib/types"
import type { ReportLayerTab } from "@/lib/dashboard-config"

export type DashboardDataSource = "api" | "cache" | "mock"

export interface ReportLayerCard {
  id: string
  title: string
  value: string
  description?: string
  severity?: number
  meta?: Record<string, unknown>
}

export interface ReportLayer {
  key: ReportLayerTab
  title: string
  narrative: string
  cards: ReportLayerCard[]
  metrics: Record<string, unknown>
  updatedAt: string
}

export interface ReportLayers {
  summary: ReportLayer
  signals: ReportLayer
  issues: ReportLayer
  actions: ReportLayer
}

export function buildEmptyReportLayers(nowIso = new Date().toISOString()): ReportLayers {
  const layer = (key: ReportLayerTab, title: string): ReportLayer => ({
    key,
    title,
    narrative: "",
    cards: [],
    metrics: {},
    updatedAt: nowIso,
  })
  return {
    summary: layer("summary", "Summary"),
    signals: layer("signals", "Signals"),
    issues: layer("issues", "Issues"),
    actions: layer("actions", "Actions"),
  }
}

export interface DashboardData {
  runId: string | null
  appName: string
  packageName: string
  countriesFetched: string[]
  product: Product
  reputationStats: ReputationStats
  issueStats: IssueStats
  responseStats: ResponseStats
  timelineData: TimelinePoint[]
  reviews: Review[]
  clusters: Cluster[]
  alerts: Alert[]
  actionItems: ActionItem[]
  reportLayers: ReportLayers
  executiveSummary?: string
  markdown?: string
  communityPulse?: CommunityPulseStats
  communityThreads?: CommunityThread[]
  sourceComparison?: SourceComparisonStats
  communityDataLoaded: boolean
  lastUpdated: string
  source: DashboardDataSource
}
