"use client"

import { useState } from "react"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AppResult, ScanParams } from "@/lib/lead-search/types"
import type { DatePreset } from "@/lib/date-filters"

interface ResultsTableProps {
  results: AppResult[]
  scanParams: ScanParams | null
  reportCountry: string
  reportPeriod: DatePreset
  reportCustomFrom: string
  reportCustomTo: string
  canGenerateReports: boolean
}

type SortField = keyof AppResult
type SortOrder = "asc" | "desc"

function SortButton({ field, label, onSort }: { field: SortField; label: string; onSort: (field: SortField) => void }) {
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-foreground">
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )
}

export function ResultsTable({
  results,
  scanParams,
  reportCountry,
  reportPeriod,
  reportCustomFrom,
  reportCustomTo,
  canGenerateReports,
}: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>("lead_score")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
      return
    }
    setSortField(field)
    setSortOrder("desc")
  }

  const sorted = [...results].sort((left, right) => {
    const leftVal = left[sortField]
    const rightVal = right[sortField]

    if (leftVal === null) return 1
    if (rightVal === null) return -1

    let cmp = 0
    if (typeof leftVal === "number" && typeof rightVal === "number") {
      cmp = leftVal - rightVal
    } else {
      cmp = String(leftVal).localeCompare(String(rightVal))
    }

    return sortOrder === "asc" ? cmp : -cmp
  })

  const getLeadBadge = (score: number) => {
    if (score >= 70) return <Badge variant="default">High</Badge>
    if (score >= 40) return <Badge variant="secondary">Medium</Badge>
    return <Badge variant="outline">Low</Badge>
  }

  const buildReportUrl = (result: AppResult) => {
    const query = new URLSearchParams()
    query.set("url", result.url)
    query.set("country", reportCountry || scanParams?.country || "us")
    query.set("source", "catalog")
    query.set("app_id", result.appId)
    query.set("lang", scanParams?.lang || "en")
    query.set("period", reportPeriod)
    if (reportPeriod === "custom" && reportCustomFrom && reportCustomTo) {
      query.set("from", reportCustomFrom)
      query.set("to", reportCustomTo)
    }
    return `/report?${query.toString()}`
  }

  if (!results.length) {
    return <div className="py-12 text-center text-muted-foreground">No results yet. Start a scan to see leads.</div>
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><SortButton field="developer" label="Developer" onSort={handleSort} /></TableHead>
            <TableHead><SortButton field="title" label="Title" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="no_reply_rate" label="No Reply %" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="no_reply_rate_neg" label="No Reply Neg %" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="unanswered_neg_30d" label="Unans. 30d" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="lead_score" label="Lead Score" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="score" label="Rating" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="total_reviews_count" label="Reviews" onSort={handleSort} /></TableHead>
            <TableHead className="text-right"><SortButton field="min_installs" label="Downloads" onSort={handleSort} /></TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((result, idx) => (
            <TableRow key={`${result.appId}-${idx}`}>
              <TableCell className="font-medium">{result.developer}</TableCell>
              <TableCell>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {result.title}
                </a>
              </TableCell>
              <TableCell className="text-right">{result.no_reply_rate.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{result.no_reply_rate_neg.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{result.unanswered_neg_30d}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {result.lead_score}
                  {getLeadBadge(result.lead_score)}
                </div>
              </TableCell>
              <TableCell className="text-right">{result.score.toFixed(1)}</TableCell>
              <TableCell className="text-right">{result.total_reviews_count.toLocaleString()}</TableCell>
              <TableCell className="text-right">{result.installs ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" asChild disabled={!canGenerateReports}>
                  <a href={canGenerateReports ? buildReportUrl(result) : "#"} target="_blank" rel="noopener noreferrer">
                    Сформировать отчет
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
