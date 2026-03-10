export type DashboardRoleProfile = "producer" | "support" | "engineering"
export type ReportLayerTab = "summary" | "signals" | "issues" | "actions"
export type DashboardWidgetKey =
  | "status_cards"
  | "timeline"
  | "top_clusters"
  | "action_board"
  | "layered_report"
  | "community_pulse"
  | "source_comparison"
  | "community_threads"
export type DashboardKpiKey =
  | "current_rating"
  | "rating_trend"
  | "low_rating_share"
  | "low_rating_share_change"
  | "new_clusters"
  | "spike_count"
  | "critical_count"
  | "unanswered_percent"
  | "unanswered_negatives"
  | "total_unanswered"

export interface DashboardConfig {
  package_name: string
  role_profile: DashboardRoleProfile
  visible_tabs: ReportLayerTab[]
  tab_order: ReportLayerTab[]
  visible_widgets: DashboardWidgetKey[]
  kpi_set: DashboardKpiKey[]
  version: number
  updated_at: string
}

export interface DashboardConfigUpdatePayload {
  visible_tabs?: ReportLayerTab[]
  tab_order?: ReportLayerTab[]
  visible_widgets?: DashboardWidgetKey[]
  kpi_set?: DashboardKpiKey[]
  version?: number
}

const DEFAULT_ROLE_PROFILE: DashboardRoleProfile = "producer"

const ROLE_DEFAULTS: Record<DashboardRoleProfile, Omit<DashboardConfig, "package_name" | "role_profile" | "updated_at">> = {
  producer: {
    visible_tabs: ["summary", "signals", "issues", "actions"],
    tab_order: ["summary", "signals", "issues", "actions"],
    visible_widgets: [
      "status_cards",
      "timeline",
      "top_clusters",
      "action_board",
      "community_pulse",
      "source_comparison",
      "community_threads",
      "layered_report",
    ],
    kpi_set: ["current_rating", "low_rating_share", "new_clusters", "critical_count", "unanswered_percent"],
    version: 2,
  },
  support: {
    visible_tabs: ["summary", "signals", "issues", "actions"],
    tab_order: ["summary", "signals", "issues", "actions"],
    visible_widgets: ["status_cards", "top_clusters", "action_board", "community_pulse", "community_threads", "layered_report"],
    kpi_set: ["unanswered_percent", "unanswered_negatives", "total_unanswered", "new_clusters", "spike_count"],
    version: 2,
  },
  engineering: {
    visible_tabs: ["summary", "signals", "issues", "actions"],
    tab_order: ["signals", "issues", "actions", "summary"],
    visible_widgets: ["status_cards", "timeline", "top_clusters", "community_pulse", "source_comparison", "layered_report"],
    kpi_set: ["critical_count", "spike_count", "new_clusters", "rating_trend", "current_rating"],
    version: 2,
  },
}

export const DASHBOARD_TABS: ReportLayerTab[] = ["summary", "signals", "issues", "actions"]
export const DASHBOARD_WIDGETS: DashboardWidgetKey[] = [
  "status_cards",
  "timeline",
  "top_clusters",
  "action_board",
  "community_pulse",
  "source_comparison",
  "community_threads",
  "layered_report",
]
export const DASHBOARD_KPIS: DashboardKpiKey[] = [
  "current_rating",
  "rating_trend",
  "low_rating_share",
  "low_rating_share_change",
  "new_clusters",
  "spike_count",
  "critical_count",
  "unanswered_percent",
  "unanswered_negatives",
  "total_unanswered",
]

function uniqueOrdered<T extends string>(items: T[]): T[] {
  const seen = new Set<T>()
  const output: T[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    output.push(item)
  }
  return output
}

export function normalizeRoleProfile(raw: string | null | undefined): DashboardRoleProfile {
  const value = String(raw || DEFAULT_ROLE_PROFILE).toLowerCase()
  if (value === "support" || value === "engineering") return value
  return DEFAULT_ROLE_PROFILE
}

export function buildDefaultDashboardConfig(
  packageName: string,
  roleProfile: DashboardRoleProfile = DEFAULT_ROLE_PROFILE,
): DashboardConfig {
  const defaults = ROLE_DEFAULTS[roleProfile]
  return {
    package_name: packageName,
    role_profile: roleProfile,
    visible_tabs: [...defaults.visible_tabs],
    tab_order: [...defaults.tab_order],
    visible_widgets: [...defaults.visible_widgets],
    kpi_set: [...defaults.kpi_set],
    version: defaults.version,
    updated_at: new Date().toISOString(),
  }
}

export function normalizeDashboardConfig(
  raw: Partial<DashboardConfig> | null | undefined,
  packageName: string,
  roleProfile: DashboardRoleProfile,
): DashboardConfig {
  const base = buildDefaultDashboardConfig(packageName, roleProfile)
  if (!raw) return base

  const visibleTabs = uniqueOrdered(
    ((raw.visible_tabs || base.visible_tabs) as ReportLayerTab[]).filter((item) => DASHBOARD_TABS.includes(item)),
  )
  const tabOrderInput = ((raw.tab_order || base.tab_order) as ReportLayerTab[]).filter((item) => visibleTabs.includes(item))
  const tabOrder = uniqueOrdered([...tabOrderInput, ...visibleTabs])

  const legacyVersion = Number(raw.version || 1)
  const incomingWidgets = uniqueOrdered(
    ((raw.visible_widgets || base.visible_widgets) as DashboardWidgetKey[]).filter((item) =>
      DASHBOARD_WIDGETS.includes(item),
    ),
  )
  const legacyWidgetsNeedUpgrade = legacyVersion < 2
  const visibleWidgets = legacyWidgetsNeedUpgrade
    ? uniqueOrdered([...incomingWidgets, ...base.visible_widgets])
    : incomingWidgets

  const kpiSet = uniqueOrdered(
    ((raw.kpi_set || base.kpi_set) as DashboardKpiKey[]).filter((item) => DASHBOARD_KPIS.includes(item)),
  )

  return {
    package_name: packageName,
    role_profile: normalizeRoleProfile(raw.role_profile || roleProfile),
    visible_tabs: visibleTabs.length ? visibleTabs : base.visible_tabs,
    tab_order: tabOrder.length ? tabOrder : base.tab_order,
    visible_widgets: visibleWidgets.length ? visibleWidgets : base.visible_widgets,
    kpi_set: kpiSet.length ? kpiSet : base.kpi_set,
    version: Number(raw.version || base.version || 2),
    updated_at: String(raw.updated_at || base.updated_at),
  }
}

export function configStorageKey(packageName: string, roleProfile: DashboardRoleProfile): string {
  return `review-dashboard:config:v1:${packageName}:${roleProfile}`
}
