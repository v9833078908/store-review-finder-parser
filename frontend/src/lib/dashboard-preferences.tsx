"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { usePathname } from "next/navigation"
import {
  DEFAULT_LOCALE,
  detectLocaleFromBrowser,
  parseLocale,
  type SupportedLocale,
} from "@/lib/i18n"
import {
  buildDefaultDashboardConfig,
  configStorageKey,
  normalizeDashboardConfig,
  normalizeRoleProfile,
  type DashboardConfig,
  type DashboardConfigUpdatePayload,
  type DashboardRoleProfile,
} from "@/lib/dashboard-config"
import {
  DEFAULT_DATE_FILTER,
  filtersEqual,
  normalizeDateFilter,
  parseDateFilterFromSearchParams,
  parseStoredDateFilter,
  resolveDateRange,
  serializeDateFilter,
  type DateFilterState,
} from "@/lib/date-filters"

const LOCALE_STORAGE_KEY = "review-dashboard:locale:v1"
const DATE_FILTER_STORAGE_KEY = "review-dashboard:date-filter:v1"

interface DashboardPreferencesContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  dateFilter: DateFilterState
  applyDateFilter: (filter: DateFilterState) => void
  resetDateFilter: () => void
  resolvedDateRange: ReturnType<typeof resolveDateRange>
  loadDashboardConfig: (packageName: string, roleProfile: DashboardRoleProfile) => Promise<DashboardConfig>
  saveDashboardConfig: (
    packageName: string,
    roleProfile: DashboardRoleProfile,
    payload: DashboardConfigUpdatePayload,
  ) => Promise<DashboardConfig>
}

const DashboardPreferencesContext = createContext<DashboardPreferencesContextValue | null>(null)

function readInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE

  const searchLocale = parseLocale(new URLSearchParams(window.location.search).get("lang"))
  if (searchLocale) return searchLocale

  let storedLocale: SupportedLocale | null = null
  try {
    storedLocale = parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY))
  } catch {
    storedLocale = null
  }
  if (storedLocale) return storedLocale

  return detectLocaleFromBrowser()
}

function readInitialDateFilter(): DateFilterState {
  if (typeof window === "undefined") return DEFAULT_DATE_FILTER

  const fromSearch = parseDateFilterFromSearchParams(new URLSearchParams(window.location.search))
  if (fromSearch) return fromSearch

  let fromStorage: DateFilterState | null = null
  try {
    fromStorage = parseStoredDateFilter(localStorage.getItem(DATE_FILTER_STORAGE_KEY))
  } catch {
    fromStorage = null
  }
  if (fromStorage) return fromStorage

  return DEFAULT_DATE_FILTER
}

export function DashboardPreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [locale, setLocaleState] = useState<SupportedLocale>(readInitialLocale)
  const [dateFilter, setDateFilter] = useState<DateFilterState>(readInitialDateFilter)

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale)
  }, [])

  const applyDateFilter = useCallback((filter: DateFilterState) => {
    setDateFilter((current) => {
      const normalized = normalizeDateFilter(filter)
      if (filtersEqual(current, normalized)) return current
      return normalized
    })
  }, [])

  const resetDateFilter = useCallback(() => {
    setDateFilter(DEFAULT_DATE_FILTER)
  }, [])

  const loadDashboardConfig = useCallback(
    async (packageName: string, roleProfile: DashboardRoleProfile): Promise<DashboardConfig> => {
      const normalizedRole = normalizeRoleProfile(roleProfile)
      const fallback = buildDefaultDashboardConfig(packageName, normalizedRole)
      const key = configStorageKey(packageName, normalizedRole)

      try {
        const url = new URL("/api/dashboard-config", window.location.origin)
        url.searchParams.set("package_name", packageName)
        url.searchParams.set("role_profile", normalizedRole)

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
        })
        if (!response.ok) {
          throw new Error(`Config request failed (${response.status})`)
        }

        const payload = (await response.json()) as Partial<DashboardConfig>
        const normalized = normalizeDashboardConfig(payload, packageName, normalizedRole)
        try {
          localStorage.setItem(key, JSON.stringify(normalized))
        } catch {
          // Ignore storage failures.
        }
        return normalized
      } catch {
        try {
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<DashboardConfig>
            return normalizeDashboardConfig(parsed, packageName, normalizedRole)
          }
        } catch {
          // Ignore fallback failures.
        }
        return fallback
      }
    },
    [],
  )

  const saveDashboardConfig = useCallback(
    async (
      packageName: string,
      roleProfile: DashboardRoleProfile,
      payload: DashboardConfigUpdatePayload,
    ): Promise<DashboardConfig> => {
      const normalizedRole = normalizeRoleProfile(roleProfile)
      const key = configStorageKey(packageName, normalizedRole)
      const fallback = normalizeDashboardConfig(
        {
          package_name: packageName,
          role_profile: normalizedRole,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        packageName,
        normalizedRole,
      )

      try {
        const url = new URL("/api/dashboard-config", window.location.origin)
        url.searchParams.set("package_name", packageName)
        url.searchParams.set("role_profile", normalizedRole)

        const response = await fetch(url.toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          throw new Error(`Config save failed (${response.status})`)
        }

        const serverPayload = (await response.json()) as Partial<DashboardConfig>
        const normalized = normalizeDashboardConfig(serverPayload, packageName, normalizedRole)
        try {
          localStorage.setItem(key, JSON.stringify(normalized))
        } catch {
          // Ignore storage failures.
        }
        return normalized
      } catch {
        try {
          localStorage.setItem(key, JSON.stringify(fallback))
        } catch {
          // Ignore storage failures.
        }
        return fallback
      }
    },
    [],
  )

  const resolvedDateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter])

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // Ignore storage write failures.
    }
  }, [locale])

  useEffect(() => {
    try {
      localStorage.setItem(DATE_FILTER_STORAGE_KEY, serializeDateFilter(dateFilter))
    } catch {
      // Ignore storage write failures.
    }
  }, [dateFilter])

  useEffect(() => {
    if (typeof window === "undefined") return

    const url = new URL(window.location.href)
    const params = new URLSearchParams(url.search)

    params.set("lang", locale)
    params.set("period", dateFilter.preset)

    if (dateFilter.preset === "custom" && dateFilter.customFrom && dateFilter.customTo) {
      params.set("from", dateFilter.customFrom)
      params.set("to", dateFilter.customTo)
    } else {
      params.delete("from")
      params.delete("to")
    }

    const nextSearch = params.toString()
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl)
    }
  }, [pathname, locale, dateFilter])

  const value = useMemo<DashboardPreferencesContextValue>(
    () => ({
      locale,
      setLocale,
      dateFilter,
      applyDateFilter,
      resetDateFilter,
      resolvedDateRange,
      loadDashboardConfig,
      saveDashboardConfig,
    }),
    [
      applyDateFilter,
      dateFilter,
      loadDashboardConfig,
      locale,
      resetDateFilter,
      resolvedDateRange,
      saveDashboardConfig,
      setLocale,
    ],
  )

  return (
    <DashboardPreferencesContext.Provider value={value}>
      {children}
    </DashboardPreferencesContext.Provider>
  )
}

export function useDashboardPreferences(): DashboardPreferencesContextValue {
  const ctx = useContext(DashboardPreferencesContext)
  if (!ctx) {
    throw new Error("useDashboardPreferences must be used within DashboardPreferencesProvider")
  }
  return ctx
}
