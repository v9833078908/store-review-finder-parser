"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

interface MarkdownPanelProps {
  markdown: string
}

export function MarkdownPanel({ markdown }: MarkdownPanelProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  if (!markdown.trim()) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.markdownPanel.title}</CardTitle>
        <CardDescription>{text.markdownPanel.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-4 text-xs whitespace-pre-wrap">
          {markdown}
        </pre>
      </CardContent>
    </Card>
  )
}
