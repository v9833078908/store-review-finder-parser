// Core data types for gamedev review dashboard

export type Platform = 'iOS' | 'Android' | 'Steam' | 'PC' | 'Console';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Severity = 'P0' | 'P1' | 'P2';
export type IssueStatus = 'New' | 'Investigating' | 'Fixed' | 'Monitoring';
export type StateStatus = 'green' | 'yellow' | 'red' | 'gray';

// Feedback Item (unified VoC entry)
export interface FeedbackItem {
  id: string;
  source: 'Store' | 'Community' | 'Support';
  timestamp: Date;
  platform: Platform;
  region: string;
  language: string;
  app_version: string;
  build: string;
  sentiment: Sentiment;
  topic_tags: string[];
  severity: Severity;
  cluster_id?: string;
  text: string;
  rating?: number;
  user_id?: string;
}

// Issue Cluster
export interface IssueCluster {
  id: string;
  title: string;
  topics: string[];
  volume_24h: number;
  volume_7d: number;
  trend: 'rising' | 'stable' | 'falling';
  affected_segments: {
    versions?: string[];
    platforms?: Platform[];
    regions?: string[];
  };
  examples: FeedbackItem[];
  jira_link?: string;
  status: IssueStatus;
  owner?: string;
  created_at: Date;
  severity: Severity;
}

// Essential State
export interface EssentialState {
  name: string;
  status: StateStatus;
  primary_metric: {
    value: number;
    label: string;
    formatted: string;
  };
  delta: {
    value: number;
    percentage: boolean;
    formatted: string;
    comparison_label: string;
  };
  context: {
    top_issue?: string;
    owner: string;
    degraded_since?: Date;
  };
}

// Agent Scorecard
export interface AgentScorecard {
  agent_id: string;
  agent_name: string;
  period: {
    start: Date;
    end: Date;
  };

  // Load
  tickets_solved: number;
  tickets_solved_weighted: number;
  wip_current: number;
  wip_avg: number;

  // Speed
  frt_median_minutes: number;
  frt_p90_minutes: number;
  frt_sla_breach_pct: number;
  ttr_median_hours: number;
  ttr_p90_hours: number;

  // Quality
  csat_score: number;
  csat_sample_size: number;
  fcr_rate: number;
  reopen_rate: number;

  // Process
  reassignment_rate: number;
  escalation_rate: number;
  escalations_to_dev: number;
  escalations_to_billing: number;

  // Product impact
  bug_reports_created: number;
  kb_articles_contributed: number;
}

// Queue Health
export interface QueueHealth {
  inflow_24h: number;
  solved_24h: number;
  backlog_current: number;
  backlog_trend: 'growing' | 'stable' | 'shrinking';

  aging: {
    under_4h: number;
    under_24h: number;
    over_24h: number;
    over_72h: number;
  };

  sla_at_risk: number;
  sla_at_risk_pct: number;

  channel_distribution: {
    email: number;
    chat: number;
    in_app: number;
  };
}

// LiveOps Event
export interface LiveOpsEvent {
  id: string;
  name: string;
  type: 'event' | 'offer' | 'ab_test';
  status: 'scheduled' | 'active' | 'completed' | 'paused';
  start_date: Date;
  end_date: Date;
  segment?: string;

  impact: {
    arpdau_uplift: number;
    conversion_uplift: number;
    retention_delta: number;
  };

  guardrails: {
    crash_free: number;
    payment_success: number;
    support_load: number;
    store_rating: number;
  };
}

// Action Item
export interface ActionItem {
  id: string;
  type: 'incident' | 'growth_hypothesis';
  severity?: Severity;
  expected_impact?: string;
  kpi_impacted: string[];
  owner: string;
  status: 'investigating' | 'fixing' | 'monitoring' | 'done';
  next_checkpoint: Date;
  description: string;
  created_at: Date;
}

// Dashboard Filters
export interface DashboardFilters {
  period: '1h' | '6h' | '24h' | '7d' | '30d';
  platforms: Platform[];
  regions: string[];
  versions: string[];
  segments: ('new_users' | 'returning' | 'payers' | 'free')[];
}
