"use client"

import { useState, useMemo } from "react"
import type { FeedbackSource, Review, ReviewCategory } from "@/lib/types"

export interface ReviewFilters {
  rating: number | null
  lang: string | null
  country: string | null
  version: string | null
  category: ReviewCategory | null
  source: FeedbackSource | null
}

export function useFilters(reviews: Review[]) {
  const [filters, setFilters] = useState<ReviewFilters>({
    rating: null,
    lang: null,
    country: null,
    version: null,
    category: null,
    source: null,
  })

  const filtered = useMemo(() => {
    return reviews.filter((review) => {
      if (filters.rating !== null && review.rating !== filters.rating) return false
      if (filters.lang && review.lang !== filters.lang) return false
      if (filters.country && review.country !== filters.country) return false
      if (filters.version && review.appVersion !== filters.version) return false
      if (filters.category && review.category !== filters.category) return false
      if (filters.source && review.source !== filters.source) return false
      return true
    })
  }, [reviews, filters])

  const updateFilter = (key: keyof ReviewFilters, value: ReviewFilters[keyof ReviewFilters]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      rating: null,
      lang: null,
        country: null,
        version: null,
        category: null,
        source: null,
      })
  }

  // Get unique values for filter options
  const options = useMemo(
    () => ({
      langs: Array.from(new Set(reviews.map((r) => r.lang))).sort(),
      countries: Array.from(new Set(reviews.map((r) => r.country))).sort(),
      versions: Array.from(new Set(reviews.map((r) => r.appVersion))).sort(),
      sources: Array.from(new Set(reviews.map((r) => r.source))).sort(),
    }),
    [reviews]
  )

  return {
    filters,
    filtered,
    updateFilter,
    clearFilters,
    options,
  }
}
