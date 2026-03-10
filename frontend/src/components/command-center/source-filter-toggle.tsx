"use client"

import { Layers3, MessageSquareText, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"
import type { FeedbackSource } from "@/lib/types"

interface SourceFilterToggleProps {
  value: FeedbackSource | null
  onChange: (next: FeedbackSource | null) => void
}

export function SourceFilterToggle({ value, onChange }: SourceFilterToggleProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border bg-card/70 p-1.5">
      <Button
        type="button"
        size="sm"
        variant={value === null ? "default" : "ghost"}
        className="h-11 gap-1.5 px-3"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
      >
        <Layers3 className="h-4 w-4" />
        {text.sourceFilter.all}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "google_play" ? "default" : "ghost"}
        className="h-11 gap-1.5 px-3"
        onClick={() => onChange("google_play")}
        aria-pressed={value === "google_play"}
      >
        <Store className="h-4 w-4" />
        {text.sourceFilter.store}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "community" ? "default" : "ghost"}
        className="h-11 gap-1.5 px-3"
        onClick={() => onChange("community")}
        aria-pressed={value === "community"}
      >
        <MessageSquareText className="h-4 w-4" />
        {text.sourceFilter.community}
      </Button>
    </div>
  )
}
