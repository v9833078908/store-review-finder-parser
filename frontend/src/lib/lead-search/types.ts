export interface ScanParams {
  collection: string
  category?: string
  country: string
  lang: string
  maxApps: number
  maxReviews: number
  windowDays: number
  minAgeDays: number
}

export interface AppResult {
  developer: string
  title: string
  url: string
  no_reply_rate: number
  no_reply_rate_neg: number
  unanswered_neg_30d: number
  lead_score: number
  appId: string
  developerEmail: string | null
  score: number
  total_reviews_count: number
  sample_size: number
}

export type ScanEvent =
  | { type: "progress"; current: number; total: number; appId: string; title: string }
  | { type: "result"; data: AppResult }
  | { type: "error"; message: string; appId?: string }
  | { type: "done"; totalProcessed: number; totalErrors: number; country?: string }

export interface ResolvedAppCandidate {
  app_id: string
  title: string
  url: string
  score?: number | null
  reviews_count?: number | string | null
  is_top1: boolean
}

export interface ResolveResponse {
  input_type: "package" | "details_url" | "search_url" | "query"
  recommended_app_id: string
  candidates: ResolvedAppCandidate[]
}
