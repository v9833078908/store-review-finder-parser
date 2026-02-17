"use client"

import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReportLayers } from "@/lib/dashboard-types"
import type { ReportLayerTab } from "@/lib/dashboard-config"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"

interface LayeredReportProps {
  layers: ReportLayers
  visibleTabs: ReportLayerTab[]
  tabOrder: ReportLayerTab[]
}

function tabLabel(tab: ReportLayerTab, locale: "en" | "ru"): string {
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

export function LayeredReport({ layers, visibleTabs, tabOrder }: LayeredReportProps) {
  const { locale } = useDashboardPreferences()

  const orderedTabs = useMemo(() => {
    const allowed = new Set(visibleTabs)
    const output: ReportLayerTab[] = []
    for (const tab of tabOrder) {
      if (!allowed.has(tab)) continue
      if (output.includes(tab)) continue
      output.push(tab)
    }
    for (const tab of visibleTabs) {
      if (!output.includes(tab)) output.push(tab)
    }
    return output
  }, [tabOrder, visibleTabs])

  if (!orderedTabs.length) {
    return null
  }

  const layerByKey = {
    summary: layers.summary,
    signals: layers.signals,
    issues: layers.issues,
    actions: layers.actions,
  }

  const defaultTab = orderedTabs[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{locale === "ru" ? "Единый отчет" : "Unified Report"}</CardTitle>
        <CardDescription>
          {locale === "ru"
            ? "Один отчет, разделенный на управленческие и операционные слои"
            : "Single report split into managerial and operational layers"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {orderedTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tabLabel(tab, locale)}
              </TabsTrigger>
            ))}
          </TabsList>

          {orderedTabs.map((tab) => {
            const layer = layerByKey[tab]
            return (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{layer.title || tabLabel(tab, locale)}</h3>
                  <p className="text-sm text-muted-foreground">{layer.narrative}</p>
                </div>

                {layer.cards.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {layer.cards.map((card) => (
                      <div key={card.id} className="rounded-md border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{card.title}</p>
                          {typeof card.severity === "number" ? (
                            <Badge variant={card.severity >= 4 ? "destructive" : "outline"}>
                              {locale === "ru" ? "Severity" : "Severity"} {card.severity}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-base font-semibold">{card.value}</p>
                        {card.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {locale === "ru" ? "В этом слое пока нет карточек." : "No cards available for this layer."}
                  </div>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}
