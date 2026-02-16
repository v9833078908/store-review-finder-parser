import type { AppResult } from "@/lib/lead-search/types"

export function generateCsv(results: AppResult[]): string {
  const header = [
    "developer",
    "title",
    "url",
    "no_reply_rate",
    "no_reply_rate_neg",
    "unanswered_neg_30d",
    "lead_score",
    "appId",
    "developerEmail",
    "score",
    "total_reviews_count",
    "sample_size",
  ].join(",")

  const rows = results.map((result) => {
    return [
      escapeCsvField(result.developer),
      escapeCsvField(result.title),
      result.url,
      result.no_reply_rate,
      result.no_reply_rate_neg,
      result.unanswered_neg_30d,
      result.lead_score,
      result.appId,
      result.developerEmail || "",
      result.score,
      result.total_reviews_count,
      result.sample_size,
    ].join(",")
  })

  return [header, ...rows].join("\n")
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
