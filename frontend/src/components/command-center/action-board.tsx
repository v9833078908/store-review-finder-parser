"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ActionItem } from "@/lib/types"
import { Bug, FileText, MessageSquare, AlertOctagon, Search } from "lucide-react"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

interface ActionBoardProps {
  actions: ActionItem[]
}

const actionIcons = {
  hotfix: Bug,
  faq: FileText,
  reply_template: MessageSquare,
  escalation: AlertOctagon,
  investigation: Search,
}

function importanceBg(value: number): string {
  if (value >= 9) return "bg-red-500 text-white"
  if (value >= 7) return "bg-orange-400 text-white"
  if (value >= 4) return "bg-amber-400 text-white"
  return "bg-zinc-200 text-zinc-600"
}

export function ActionBoard({ actions }: ActionBoardProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.actionBoard.title}</CardTitle>
        <CardDescription>{text.actionBoard.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const Icon = actionIcons[action.type]
          return (
            <div
              key={action.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${importanceBg(action.importance)}`}>
                <span className="font-mono text-xs font-bold">{action.importance}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium leading-tight">{action.title}</span>
                </div>
                {action.rationale && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.rationale}</p>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
