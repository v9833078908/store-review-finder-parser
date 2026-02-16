import { MOSCOW_TIMEZONE, SupportedLocale, toIntlLocale } from "@/lib/i18n"

export type DatePreset = "24h" | "7d" | "14d" | "30d" | "90d" | "custom"

export interface DateFilterState {
  preset: DatePreset
  customFrom: string
  customTo: string
}

export interface ResolvedDateRange {
  from: Date
  to: Date
}

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000

export const DEFAULT_DATE_FILTER: DateFilterState = {
  preset: "7d",
  customFrom: "",
  customTo: "",
}

function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return { year, month, day }
}

export function moscowDateKeyToUtc(dateKey: string, boundary: "start" | "end"): Date | null {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null
  const utcMs =
    boundary === "start"
      ? Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0) - MOSCOW_OFFSET_MS
      : Date.UTC(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999) - MOSCOW_OFFSET_MS
  return new Date(utcMs)
}

export function normalizeDateFilter(input: DateFilterState): DateFilterState {
  if (input.preset !== "custom") {
    return {
      preset: input.preset,
      customFrom: "",
      customTo: "",
    }
  }

  return {
    preset: "custom",
    customFrom: input.customFrom,
    customTo: input.customTo,
  }
}

export function parseDateFilterFromSearchParams(searchParams: URLSearchParams): DateFilterState | null {
  const presetRaw = searchParams.get("period") as DatePreset | null
  if (!presetRaw) return null
  const presetValues: DatePreset[] = ["24h", "7d", "14d", "30d", "90d", "custom"]
  if (!presetValues.includes(presetRaw)) return null

  const customFrom = searchParams.get("from") || ""
  const customTo = searchParams.get("to") || ""

  if (presetRaw === "custom") {
    return normalizeDateFilter({
      preset: "custom",
      customFrom,
      customTo,
    })
  }

  return normalizeDateFilter({
    preset: presetRaw,
    customFrom: "",
    customTo: "",
  })
}

export function isCustomRangeValid(filter: DateFilterState): boolean {
  if (filter.preset !== "custom") return true
  if (!filter.customFrom || !filter.customTo) return false
  if (filter.customFrom > filter.customTo) return false
  return moscowDateKeyToUtc(filter.customFrom, "start") !== null && moscowDateKeyToUtc(filter.customTo, "end") !== null
}

export function resolveDateRange(filter: DateFilterState, now = new Date()): ResolvedDateRange {
  if (filter.preset === "custom" && isCustomRangeValid(filter)) {
    const from = moscowDateKeyToUtc(filter.customFrom, "start")
    const to = moscowDateKeyToUtc(filter.customTo, "end")
    if (from && to) {
      return { from, to }
    }
  }

  const durationHoursByPreset: Record<Exclude<DatePreset, "custom">, number> = {
    "24h": 24,
    "7d": 24 * 7,
    "14d": 24 * 14,
    "30d": 24 * 30,
    "90d": 24 * 90,
  }

  const preset = filter.preset === "custom" ? "7d" : filter.preset
  const from = new Date(now.getTime() - durationHoursByPreset[preset] * 60 * 60 * 1000)
  return { from, to: now }
}

export function isDateInRange(dateValue: string, range: ResolvedDateRange): boolean {
  const dt = new Date(dateValue)
  if (Number.isNaN(dt.getTime())) return false
  return dt >= range.from && dt <= range.to
}

export function isMoscowDateKeyInRange(dateKey: string, range: ResolvedDateRange): boolean {
  const start = moscowDateKeyToUtc(dateKey, "start")
  const end = moscowDateKeyToUtc(dateKey, "end")
  if (!start || !end) return false
  return end >= range.from && start <= range.to
}

export function serializeDateFilter(filter: DateFilterState): string {
  return JSON.stringify(normalizeDateFilter(filter))
}

export function parseStoredDateFilter(value: string | null): DateFilterState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<DateFilterState>
    if (!parsed || typeof parsed !== "object") return null
    const presetValues: DatePreset[] = ["24h", "7d", "14d", "30d", "90d", "custom"]
    if (!parsed.preset || !presetValues.includes(parsed.preset)) return null
    return normalizeDateFilter({
      preset: parsed.preset,
      customFrom: parsed.customFrom || "",
      customTo: parsed.customTo || "",
    })
  } catch {
    return null
  }
}

export function formatRangeLabel(
  filter: DateFilterState,
  locale: SupportedLocale,
  presetLabels: Record<DatePreset, string>,
  range: ResolvedDateRange,
): string {
  if (filter.preset !== "custom" || !isCustomRangeValid(filter)) {
    return presetLabels[filter.preset === "custom" ? "7d" : filter.preset]
  }

  const formatter = new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: MOSCOW_TIMEZONE,
  })

  return `${formatter.format(range.from)} - ${formatter.format(range.to)}`
}

export function filtersEqual(a: DateFilterState, b: DateFilterState): boolean {
  return a.preset === b.preset && a.customFrom === b.customFrom && a.customTo === b.customTo
}
