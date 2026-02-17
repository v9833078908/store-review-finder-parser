"use client"

import { useEffect, useMemo, useState } from "react"

import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  buildDefaultDashboardConfig,
  DASHBOARD_KPIS,
  DASHBOARD_TABS,
  DASHBOARD_WIDGETS,
  normalizeRoleProfile,
  type DashboardConfig,
  type DashboardKpiKey,
  type DashboardRoleProfile,
  type DashboardWidgetKey,
  type ReportLayerTab,
} from "@/lib/dashboard-config"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"

interface DashboardCustomizerProps {
  packageName: string
  config: DashboardConfig
  loading: boolean
  saving: boolean
  onRoleChange: (role: DashboardRoleProfile) => void
  onSave: (payload: {
    visible_tabs: ReportLayerTab[]
    tab_order: ReportLayerTab[]
    visible_widgets: DashboardWidgetKey[]
    kpi_set: DashboardKpiKey[]
    version: number
  }) => void
}

function labelForTab(tab: ReportLayerTab, locale: "en" | "ru"): string {
  if (locale === "ru") {
    if (tab === "summary") return "Сводка"
    if (tab === "signals") return "Сигналы"
    if (tab === "issues") return "Проблемы"
    return "Действия"
  }
  if (tab === "summary") return "Summary"
  if (tab === "signals") return "Signals"
  if (tab === "issues") return "Issues"
  return "Actions"
}

function labelForWidget(widget: DashboardWidgetKey, locale: "en" | "ru"): string {
  const ru: Record<DashboardWidgetKey, string> = {
    status_cards: "Карточки статусов",
    timeline: "Таймлайн",
    top_clusters: "Топ-кластеры",
    action_board: "Action Board",
    layered_report: "Слои отчета",
  }
  const en: Record<DashboardWidgetKey, string> = {
    status_cards: "Status cards",
    timeline: "Timeline",
    top_clusters: "Top clusters",
    action_board: "Action board",
    layered_report: "Layered report",
  }
  return locale === "ru" ? ru[widget] : en[widget]
}

function labelForKpi(kpi: DashboardKpiKey, locale: "en" | "ru"): string {
  const ru: Record<DashboardKpiKey, string> = {
    current_rating: "Текущий рейтинг",
    rating_trend: "Тренд рейтинга",
    low_rating_share: "Доля 1-2★",
    low_rating_share_change: "Изменение доли 1-2★",
    new_clusters: "Новые кластеры",
    spike_count: "Всплески",
    critical_count: "Критичные",
    unanswered_percent: "% без ответа",
    unanswered_negatives: "Негативы без ответа",
    total_unanswered: "Всего без ответа",
  }
  const en: Record<DashboardKpiKey, string> = {
    current_rating: "Current rating",
    rating_trend: "Rating trend",
    low_rating_share: "1-2★ share",
    low_rating_share_change: "1-2★ share change",
    new_clusters: "New clusters",
    spike_count: "Spikes",
    critical_count: "Critical",
    unanswered_percent: "Unanswered %",
    unanswered_negatives: "Unanswered negatives",
    total_unanswered: "Total unanswered",
  }
  return locale === "ru" ? ru[kpi] : en[kpi]
}

function toggleString<T extends string>(items: T[], value: T): T[] {
  if (items.includes(value)) return items.filter((item) => item !== value)
  return [...items, value]
}

function moveItem<T extends string>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items]
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function DashboardCustomizer({
  packageName,
  config,
  loading,
  saving,
  onRoleChange,
  onSave,
}: DashboardCustomizerProps) {
  const { locale } = useDashboardPreferences()
  const [draft, setDraft] = useState(config)

  useEffect(() => {
    setDraft(config)
  }, [config])

  const canSave = useMemo(() => {
    return draft.visible_tabs.length > 0 && draft.visible_widgets.length > 0 && draft.kpi_set.length > 0
  }, [draft.kpi_set.length, draft.visible_tabs.length, draft.visible_widgets.length])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          title={locale === "ru" ? "Настроить дашборд" : "Customize dashboard"}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{locale === "ru" ? "Кастомизация" : "Customization"}</SheetTitle>
          <SheetDescription>
            {locale === "ru"
              ? "Настройте слои отчета, виджеты и KPI под роль и рабочий сценарий"
              : "Configure report layers, widgets, and KPIs for your role and workflow"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <section className="space-y-3">
            <p className="text-sm font-medium">{locale === "ru" ? "Ролевой пресет" : "Role preset"}</p>
            <Select
              value={draft.role_profile}
              onValueChange={(value) => {
                const role = normalizeRoleProfile(value)
                onRoleChange(role)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="producer">producer</SelectItem>
                <SelectItem value="support">support</SelectItem>
                <SelectItem value="engineering">engineering</SelectItem>
              </SelectContent>
            </Select>
            {loading ? <p className="text-xs text-muted-foreground">{locale === "ru" ? "Загрузка конфигурации..." : "Loading config..."}</p> : null}
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">{locale === "ru" ? "Табы отчета" : "Report tabs"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DASHBOARD_TABS.map((tab) => (
                <label key={tab} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.visible_tabs.includes(tab)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        visible_tabs: toggleString(current.visible_tabs, tab),
                        tab_order: current.tab_order.includes(tab)
                          ? current.tab_order
                          : [...current.tab_order, tab],
                      }))
                    }
                  />
                  <span>{labelForTab(tab, locale)}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {locale === "ru" ? "Порядок табов" : "Tab order"}
              </p>
              {draft.tab_order
                .filter((tab) => draft.visible_tabs.includes(tab))
                .map((tab, index, items) => (
                  <div key={`order-${tab}`} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{labelForTab(tab, locale)}</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={index === 0}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            tab_order: moveItem(
                              current.tab_order.filter((item) => current.visible_tabs.includes(item)),
                              index,
                              -1,
                            ),
                          }))
                        }
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={index === items.length - 1}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            tab_order: moveItem(
                              current.tab_order.filter((item) => current.visible_tabs.includes(item)),
                              index,
                              1,
                            ),
                          }))
                        }
                      >
                        ↓
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">{locale === "ru" ? "Виджеты" : "Widgets"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DASHBOARD_WIDGETS.map((widget) => (
                <label key={widget} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.visible_widgets.includes(widget)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        visible_widgets: toggleString(current.visible_widgets, widget),
                      }))
                    }
                  />
                  <span>{labelForWidget(widget, locale)}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">{locale === "ru" ? "KPI" : "KPI"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DASHBOARD_KPIS.map((kpi) => (
                <label key={kpi} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.kpi_set.includes(kpi)}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        kpi_set: toggleString(current.kpi_set, kpi),
                      }))
                    }
                  />
                  <span>{labelForKpi(kpi, locale)}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(buildDefaultDashboardConfig(packageName, draft.role_profile))
              }}
            >
              {locale === "ru" ? "Сброс к роли" : "Reset to role defaults"}
            </Button>
            <Button
              disabled={!canSave || saving}
              onClick={() =>
                onSave({
                  visible_tabs: draft.visible_tabs,
                  tab_order: draft.tab_order,
                  visible_widgets: draft.visible_widgets,
                  kpi_set: draft.kpi_set,
                  version: draft.version,
                })
              }
            >
              {saving
                ? locale === "ru"
                  ? "Сохраняем..."
                  : "Saving..."
                : locale === "ru"
                ? "Сохранить"
                : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
