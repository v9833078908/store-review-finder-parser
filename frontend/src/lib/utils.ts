import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Severity, AlertSeverity, ReviewCategory, ClusterStatus } from "./types"
import { MOSCOW_TIMEZONE, toIntlLocale, type SupportedLocale } from "./i18n"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function resolveIntlLocale(locale?: SupportedLocale): string {
  if (locale) return toIntlLocale(locale)
  if (typeof document !== "undefined" && document.documentElement.lang === "ru") {
    return "ru-RU"
  }
  return "en-US"
}

export function formatDate(dateStr: string, locale?: SupportedLocale): string {
  return new Date(dateStr).toLocaleDateString(resolveIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: MOSCOW_TIMEZONE,
  })
}

export function formatDateTime(dateStr: string, locale?: SupportedLocale): string {
  return new Date(dateStr).toLocaleString(resolveIntlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    timeZone: MOSCOW_TIMEZONE,
  })
}

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

export function severityColor(severity: Severity): string {
  const map: Record<Severity, string> = {
    5: "text-red-600 dark:text-red-400",
    4: "text-orange-600 dark:text-orange-400",
    3: "text-yellow-600 dark:text-yellow-400",
    2: "text-blue-600 dark:text-blue-400",
    1: "text-green-600 dark:text-green-400",
  }
  return map[severity]
}

export function severityBadgeVariant(severity: Severity): "destructive" | "outline" | "secondary" | "default" {
  if (severity >= 5) return "destructive"
  if (severity >= 4) return "outline"
  if (severity >= 3) return "secondary"
  return "default"
}

export function alertSeverityColor(severity: AlertSeverity): string {
  const map: Record<AlertSeverity, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  }
  return map[severity]
}

export function categoryColor(category: ReviewCategory): string {
  const map: Record<ReviewCategory, string> = {
    bug: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    complaint: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    feature: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    praise: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    noise: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  }
  return map[category]
}

export function statusColor(status: ClusterStatus | string): string {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    active: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    monitoring: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    acknowledged: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  }
  return map[status] ?? ""
}

export function trendArrow(value: number): string {
  if (value > 0) return "↑"
  if (value < 0) return "↓"
  return "→"
}

export function trendColor(value: number, invertGood = false): string {
  const isGood = invertGood ? value > 0 : value < 0
  if (isGood) return "text-green-600 dark:text-green-400"
  if (value === 0) return "text-muted-foreground"
  return "text-red-600 dark:text-red-400"
}
