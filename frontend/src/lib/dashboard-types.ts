import type {
  ActionItem,
  Alert,
  Cluster,
  IssueStats,
  Product,
  ReputationStats,
  ResponseStats,
  Review,
  TimelinePoint,
} from "@/lib/types"

export type DashboardDataSource = "api" | "cache" | "mock"

export interface DashboardData {
  runId: string | null
  appName: string
  packageName: string
  product: Product
  reputationStats: ReputationStats
  issueStats: IssueStats
  responseStats: ResponseStats
  timelineData: TimelinePoint[]
  reviews: Review[]
  clusters: Cluster[]
  alerts: Alert[]
  actionItems: ActionItem[]
  markdown: string
  lastUpdated: string
  source: DashboardDataSource
}
