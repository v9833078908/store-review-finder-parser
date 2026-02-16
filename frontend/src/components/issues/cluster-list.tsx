"use client"

import { useState } from "react"
import Link from "next/link"
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
import { ArrowUpDown, ExternalLink } from "lucide-react"
import type { Cluster } from "@/lib/types"
import { severityBadgeVariant, statusColor, formatDate, trendArrow, trendColor } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatClusterStatus, getUiText } from "@/lib/i18n"

interface ClusterListProps {
  clusters: Cluster[]
}

export function ClusterList({ clusters }: ClusterListProps) {
  const [sortBy, setSortBy] = useState<"severity" | "volume" | "trend">("severity")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortDir("desc")
    }
  }

  const sorted = [...clusters].sort((a, b) => {
    let aVal: number
    let bVal: number
    if (sortBy === "volume") {
      aVal = a.volume7d
      bVal = b.volume7d
    } else {
      aVal = a[sortBy]
      bVal = b[sortBy]
    }
    const dir = sortDir === "asc" ? 1 : -1
    return (aVal - bVal) * dir
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{text.clusterList.cluster}</TableHead>
          <TableHead>
            <Button variant="ghost" size="sm" onClick={() => toggleSort("severity")}>
              {text.clusterList.severity}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </TableHead>
          <TableHead>
            <Button variant="ghost" size="sm" onClick={() => toggleSort("volume")}>
              {text.clusterList.volume7d}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </TableHead>
          <TableHead>
            <Button variant="ghost" size="sm" onClick={() => toggleSort("trend")}>
              {text.clusterList.trend}
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </TableHead>
          <TableHead>{text.clusterList.firstLastSeen}</TableHead>
          <TableHead>{text.clusterList.status}</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((cluster) => (
          <TableRow key={cluster.id}>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Link href={`/issues/${cluster.id}`} className="font-medium hover:underline">
                  {cluster.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {cluster.topCountries.slice(0, 3).join(", ")} · {cluster.topLangs.slice(0, 3).join(", ")}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={severityBadgeVariant(cluster.severity)}>
                {cluster.severity}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{cluster.volume7d}</span>
                <span className="text-xs text-muted-foreground">{text.clusterList.reports24h}: {cluster.volume24h}</span>
              </div>
            </TableCell>
            <TableCell>
              <span className={`font-medium ${trendColor(cluster.trend)}`}>
                {trendArrow(cluster.trend)} {Math.abs(cluster.trend)}%
              </span>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              <div>{formatDate(cluster.firstSeen, locale)}</div>
              <div>{formatDate(cluster.lastSeen, locale)}</div>
            </TableCell>
            <TableCell>
              <Badge className={statusColor(cluster.status)}>
                {formatClusterStatus(cluster.status, locale)}
              </Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/issues/${cluster.id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
