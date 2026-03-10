"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CommunityThread } from "@/lib/types"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatSentiment, formatThemeLabel, getUiText } from "@/lib/i18n"

interface CommunityThreadsProps {
  threads: CommunityThread[]
}

export function CommunityThreads({ threads }: CommunityThreadsProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.communityThreads.title}</CardTitle>
        <CardDescription>{text.communityThreads.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {threads.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {text.communityThreads.noThreads}
          </div>
        )}

        {threads.map((thread) => (
          <div key={thread.id} className="rounded-lg border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{formatThemeLabel(thread.topic, locale)}</Badge>
              <Badge variant="outline" className="text-xs">
                {thread.messageCount} {text.communityThreads.messages}
              </Badge>
              <Badge variant="destructive" className="text-xs">
                {thread.negativeCount} {text.communityThreads.negative}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatSentiment(thread.sentiment, locale)}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{thread.summary}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
