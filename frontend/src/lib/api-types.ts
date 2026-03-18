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
  text_original?: string | null
  version?: string | null
  lang?: string | null
  original_lang?: string | null
  has_reply?: boolean | null
  reply_text?: string | null
  reply_date?: string | null
  /** Feedback source identifier — added in GamePulse Phase 1 multi-source support.
   *  Absent on artifacts generated before the migration. */
  source?: string | null
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

export interface ApiReportLayerCard {
  id: string
  title: string
  value: string
  description?: string
  severity?: number
  meta?: Record<string, unknown>
}

export interface ApiReportLayer {
  title: string
  narrative: string
  cards: ApiReportLayerCard[]
  metrics?: Record<string, unknown>
  updated_at?: string
}

export interface ApiReportLayers {
  summary: ApiReportLayer
  signals: ApiReportLayer
  issues: ApiReportLayer
  actions: ApiReportLayer
}

export interface RunArtifact {
  run_id: string
  package_name: string
  app_name: string
  store?: "google_play" | "app_store" | "yandex_games"
  fetched_at?: string
  saved_at?: string
  country?: string
  countries_fetched?: string[]
  langs?: string[]
  /** Primary feedback source for this artifact (e.g. "google_play").
   *  Added in GamePulse Phase 1. Absent on older artifacts — treat as "google_play". */
  feedback_source?: string
  current_version?: ApiVersionInfo
  previous_version?: ApiVersionInfo
  stats?: ApiStats
  reviews?: ApiReview[]
  classified?: ApiClassification[]
  alerts?: ApiAlert[]
  report_layers?: ApiReportLayers
  synthesis_markdown?: string
  markdown?: string
  category_counts?: Record<string, number>
  dashboard_config_snapshot?: Record<string, unknown>
  window_mode?: string
  window_from?: string | null
  window_to?: string | null
  sample_limit?: number
  reviews_selected?: number
  app_metadata?: {
    ratings?: number
    score?: number
  }
}

export interface RunHistoryItem {
  run_id: string
  package_name: string
  app_name: string
  store?: "google_play" | "app_store" | "yandex_games"
  saved_at?: string
  country?: string
  window_mode?: string
  reviews_selected?: number
  current_version?: ApiVersionInfo
  previous_version?: ApiVersionInfo
}

export interface RunHistoryResponse {
  items: RunHistoryItem[]
  count: number
}

export interface ReportSummaryPayload {
  run_id: string
  package_name: string
  app_name: string
  report_path: string
  artifact_path: string
  markdown: string
  report_layers?: ApiReportLayers
  stats: Record<string, unknown>
  category_counts: Record<string, number>
  alerts_count: number
  window_mode?: string
  window_from?: string | null
  window_to?: string | null
  sample_limit?: number
  reviews_selected?: number
}

export type ReportSseEvent =
  | { type: "status"; step: string; package?: string; title?: string; count?: number }
  | { type: "progress"; pipeline: "themes" | "classify"; current: number; total: number }
  | { type: "report"; data: ReportSummaryPayload }
  | { type: "error"; message: string }
  | { type: "done" }
