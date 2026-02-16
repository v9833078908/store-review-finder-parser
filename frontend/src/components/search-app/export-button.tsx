"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadCsv, generateCsv } from "@/lib/lead-search/csv"
import type { AppResult } from "@/lib/lead-search/types"

interface ExportButtonProps {
  results: AppResult[]
}

export function ExportButton({ results }: ExportButtonProps) {
  const handleExport = () => {
    if (!results.length) return
    const csv = generateCsv(results)
    const filename = `leads-${new Date().toISOString().split("T")[0]}.csv`
    downloadCsv(csv, filename)
  }

  return (
    <Button onClick={handleExport} disabled={!results.length} className="gap-2">
      <Download className="h-4 w-4" />
      Export CSV ({results.length})
    </Button>
  )
}
