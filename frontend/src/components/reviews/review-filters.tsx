"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"
import type { ReviewFilters } from "@/hooks/use-filters"
import type { FeedbackSource, ReviewCategory } from "@/lib/types"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatCategory, formatLanguageCode, getUiText } from "@/lib/i18n"

interface ReviewFiltersProps {
  filters: ReviewFilters
  options: {
    langs: string[]
    countries: string[]
    versions: string[]
    sources: FeedbackSource[]
  }
  onUpdateFilter: (key: keyof ReviewFilters, value: ReviewFilters[keyof ReviewFilters]) => void
  onClearFilters: () => void
}

const categories: ReviewCategory[] = ["bug", "feature", "praise", "noise", "complaint"]

export function ReviewFilters({
  filters,
  options,
  onUpdateFilter,
  onClearFilters,
}: ReviewFiltersProps) {
  const hasFilters = Object.values(filters).some((v) => v !== null)
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.source ?? "all"}
        onValueChange={(v) => onUpdateFilter("source", v === "all" ? null : (v as FeedbackSource))}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={text.reviewFilters.source} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{text.reviewFilters.allSources}</SelectItem>
          {options.sources.includes("google_play") && (
            <SelectItem value="google_play">{text.reviewFilters.sourceGooglePlay}</SelectItem>
          )}
          {options.sources.includes("community") && (
            <SelectItem value="community">{text.reviewFilters.sourceCommunity}</SelectItem>
          )}
        </SelectContent>
      </Select>

      <Select
        value={filters.rating?.toString() ?? "all"}
        onValueChange={(v) => onUpdateFilter("rating", v === "all" ? null : Number(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={text.reviewFilters.rating} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{text.reviewFilters.allRatings}</SelectItem>
          <SelectItem value="5">5 ★</SelectItem>
          <SelectItem value="4">4 ★</SelectItem>
          <SelectItem value="3">3 ★</SelectItem>
          <SelectItem value="2">2 ★</SelectItem>
          <SelectItem value="1">1 ★</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.lang ?? "all"}
        onValueChange={(v) => onUpdateFilter("lang", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={text.reviewFilters.language} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{text.reviewFilters.allLanguages}</SelectItem>
          {options.langs.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {formatLanguageCode(lang, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.country ?? "all"}
        onValueChange={(v) => onUpdateFilter("country", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={text.reviewFilters.country} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{text.reviewFilters.allCountries}</SelectItem>
          {options.countries.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.version ?? "all"}
        onValueChange={(v) => onUpdateFilter("version", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={text.reviewFilters.version} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{text.reviewFilters.allVersions}</SelectItem>
          {options.versions.map((version) => (
            <SelectItem key={version} value={version}>
              {version}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.category ?? "all"}
        onValueChange={(v) => onUpdateFilter("category", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder={text.reviewFilters.category} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{text.reviewFilters.allCategories}</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {formatCategory(cat, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X className="mr-2 h-4 w-4" />
          {text.reviewFilters.clear}
        </Button>
      )}
    </div>
  )
}
