"use client"

import { ReviewFilters } from "@/components/reviews/review-filters"
import { ReviewTable } from "@/components/reviews/review-table"
import { useFilters } from "@/hooks/use-filters"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

export default function ReviewsPage() {
  const { data, loading, error } = useDashboardData()
  const { filters, filtered, updateFilter, clearFilters, options } = useFilters(data.reviews)
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{text.pages.reviewsTitle}</h1>
        <p className="text-muted-foreground">{text.pages.reviewsSubtitle}</p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">{text.common.loadingReviews}</div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <ReviewFilters
        filters={filters}
        options={options}
        onUpdateFilter={updateFilter}
        onClearFilters={clearFilters}
      />

      <ReviewTable reviews={filtered} />
    </div>
  )
}
