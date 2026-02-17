"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Download, Star } from "lucide-react"
import type { Review } from "@/lib/types"
import { categoryColor, severityBadgeVariant, formatDateTime } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatCategory, formatSentiment, getUiText } from "@/lib/i18n"

interface ReviewTableProps {
  reviews: Review[]
}

export function ReviewTable({ reviews }: ReviewTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const exportCSV = () => {
    const headers = [
      text.reviewTable.date,
      text.reviewFilters.rating,
      text.reviewTable.text,
      text.reviewTable.originalLang,
      text.reviewFilters.country,
      text.reviewFilters.version,
      text.reviewTable.category,
      text.reviewTable.sentiment,
      text.reviewTable.severity,
    ]
    const rows = reviews.map((r) => [
      r.createdAt,
      r.rating,
      `"${r.text.replace(/"/g, '""')}"`,
      r.originalLang || r.lang,
      r.country,
      r.appVersion,
      r.category,
      r.sentiment,
      r.severity,
    ])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reviews-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {text.reviewTable.showing} {reviews.length} {reviews.length === 1 ? text.common.reviewsCountOne : text.common.reviewsCountMany}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          {text.reviewTable.exportCsv}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>{text.reviewTable.date}</TableHead>
            <TableHead>{text.reviewFilters.rating}</TableHead>
            <TableHead>{text.reviewTable.text}</TableHead>
            <TableHead>{text.reviewTable.originalLang}</TableHead>
            <TableHead>{text.reviewFilters.country}</TableHead>
            <TableHead>{text.reviewFilters.version}</TableHead>
            <TableHead>{text.reviewTable.category}</TableHead>
            <TableHead>{text.reviewTable.severity}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => {
            const isExpanded = expandedIds.has(review.id)
            const preview = review.text.slice(0, 80) + (review.text.length > 80 ? "..." : "")

            return (
              <Collapsible key={review.id} open={isExpanded}>
                <>
                  <TableRow>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(review.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(review.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {review.rating}
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate text-sm">{preview}</div>
                    </TableCell>
                    <TableCell className="text-xs">{review.originalLang || review.lang}</TableCell>
                    <TableCell className="text-xs">{review.country}</TableCell>
                    <TableCell className="text-xs">{review.appVersion}</TableCell>
                    <TableCell>
                      <Badge className={categoryColor(review.category)}>
                        {formatCategory(review.category, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityBadgeVariant(review.severity)}>
                        {review.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <CollapsibleContent>
                        <div className="border-t bg-muted/50 p-4">
                          <div className="space-y-2">
                            <div className="text-sm leading-relaxed">{review.text}</div>
                            <div className="flex flex-wrap gap-2 pt-2">
                              <Badge variant="outline" className="text-xs">
                                {text.reviewTable.sentiment}: {formatSentiment(review.sentiment, locale)}
                              </Badge>
                              {review.themes.map((theme, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </TableCell>
                  </TableRow>
                </>
              </Collapsible>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
