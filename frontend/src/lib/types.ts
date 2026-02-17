// ── Product ──
export interface Product {
  id: string;
  name: string;
  packageId: string;
  platform: "google_play" | "app_store";
  rating: number;
  totalReviews: number;
}

// ── Reviews ──
export type ReviewCategory = "bug" | "feature" | "praise" | "noise" | "complaint";
export type Sentiment = "positive" | "negative" | "mixed" | "neutral";
export type Severity = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: string;
  productId: string;
  rating: number;
  text: string;
  lang: string;
  originalLang?: string;
  country: string;
  appVersion: string;
  category: ReviewCategory;
  subcategory: string;
  sentiment: Sentiment;
  themes: string[];
  severity: Severity;
  hasReply: boolean;
  createdAt: string; // ISO date
}

// ── Clusters ──
export type ClusterStatus = "active" | "monitoring" | "resolved";

export interface Cluster {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  volume24h: number;
  volume7d: number;
  trend: number; // percentage change vs previous period
  ratingAvg: number;
  topLangs: string[];
  topCountries: string[];
  topVersions: string[];
  firstSeen: string;
  lastSeen: string;
  status: ClusterStatus;
  reviewIds: string[];
  recommendedAction: string;
}

// ── Alerts ──
export type AlertType = "new_cluster" | "spike" | "rating_drop" | "region_outbreak";
export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric: string;
  baseline: number;
  current: number;
  clusterId?: string;
  detectedAt: string;
  status: AlertStatus;
}

// ── Action Items ──
export type ActionType = "hotfix" | "faq" | "reply_template" | "escalation" | "investigation";

export interface ActionItem {
  id: string;
  type: ActionType;
  title: string;
  rationale: string;
  importance: number; // 1–10
  relatedClusterId: string;
}

// ── Timeline Data ──
export interface TimelinePoint {
  date: string;
  negativeReviews: number;
  bugReports: number;
  alerts: number;
  totalReviews: number;
  releaseVersion?: string;
}

// ── Reputation Stats ──
export interface ReputationStats {
  currentRating: number;
  ratingTrend: number; // change from last week
  lowRatingShare: number; // 1-2 star percentage
  lowRatingShareChange: number;
}

export interface IssueStats {
  newClusters: number;
  spikeCount: number;
  criticalCount: number;
}

export interface ResponseStats {
  unansweredPercent: number;
  unansweredNegatives: number;
  totalUnanswered: number;
}
