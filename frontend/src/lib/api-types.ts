export interface ApiVersionInfo {
  version?: string
  first_seen?: string
}

export interface ApiStats {
  reviews_analyzed?: number
  avg_rating?: number
  period?: string
}

export interface ApiReview {
  review_id: string
  date: string
  rating: number
  text: string
  version?: string | null
  lang?: string | null
}

export interface ApiClassification {
  review_id: string
  category: string
  subcategory: string
  device_mention?: string | null
  confidence?: number
  summary?: string
}

export interface ApiAlert {
  type: string
  subcategory: string
  count: number
  baseline: number
  details?: Record<string, unknown>
}

export interface RunArtifact {
  run_id: string
  package_name: string
  app_name: string
  fetched_at?: string
  saved_at?: string
  country?: string
  langs?: string[]
  current_version?: ApiVersionInfo
  previous_version?: ApiVersionInfo
  stats?: ApiStats
  reviews?: ApiReview[]
  classified?: ApiClassification[]
  alerts?: ApiAlert[]
  synthesis_markdown?: string
  markdown?: string
  category_counts?: Record<string, number>
  app_metadata?: {
    ratings?: number
    score?: number
  }
}

export interface ReportSummaryPayload {
  run_id: string
  package_name: string
  app_name: string
  report_path: string
  artifact_path: string
  markdown: string
  stats: Record<string, unknown>
  category_counts: Record<string, number>
  alerts_count: number
}

export type ReportSseEvent =
  | { type: "status"; step: string; package?: string; title?: string; count?: number }
  | { type: "progress"; pipeline: "themes" | "classify"; current: number; total: number }
  | { type: "report"; data: ReportSummaryPayload }
  | { type: "error"; message: string }
  | { type: "done" }
