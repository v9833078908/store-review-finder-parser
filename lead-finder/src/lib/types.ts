// Scan parameters from form
export interface ScanParams {
  collection: string;
  category?: string;
  country: string;
  lang: string;
  maxApps: number;
  maxReviews: number;
  windowDays: number;
  minAgeDays: number;
}

export interface ReportLaunchParams {
  country: string;
  lang: string;
  maxReviews: number;
}

// App result - single row in CSV
export interface AppResult {
  developer: string;
  title: string;
  url: string;
  no_reply_rate: number;
  no_reply_rate_neg: number;
  unanswered_neg_30d: number;
  lead_score: number;
  appId: string;
  developerEmail: string | null;
  score: number;
  total_reviews_count: number;
  sample_size: number;
  installs: string | null;
  min_installs: number;
}

// SSE event types
export type ScanEvent =
  | { type: 'progress'; current: number; total: number; appId: string; title: string }
  | { type: 'result'; data: AppResult }
  | { type: 'error'; message: string; appId?: string }
  | { type: 'done'; totalProcessed: number; totalErrors: number };

// Internal types for scraper
export interface AppDetails {
  appId: string;
  title: string;
  developer: string;
  developerEmail: string | null;
  score: number;
  reviews: number;
  url: string;
}

export interface ReviewData {
  id: string;
  date: Date;
  score: number;
  text: string;
  replyDate: Date | null;
  replyText: string | null;
}
