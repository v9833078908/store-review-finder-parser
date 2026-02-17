export interface RegionOption {
  code: string
  name: string
}

const ALL_REGION_OPTION: RegionOption = {
  code: "all",
  name: "All regions",
}

const FALLBACK_REGION_CODES = [
  "us",
  "ru",
  "gb",
  "de",
  "fr",
  "es",
  "it",
  "jp",
  "kr",
  "cn",
  "in",
  "br",
  "ca",
  "au",
  "mx",
  "nl",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
]

const regionCache = new Map<string, RegionOption[]>()

function getSupportedRegionCodes(): string[] {
  if (typeof Intl === "undefined") return FALLBACK_REGION_CODES

  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[]
  }

  if (typeof intlWithSupportedValues.supportedValuesOf !== "function") {
    return FALLBACK_REGION_CODES
  }

  try {
    const values = intlWithSupportedValues.supportedValuesOf("region")
    return values?.length ? values : FALLBACK_REGION_CODES
  } catch {
    return FALLBACK_REGION_CODES
  }
}

function toDisplayName(locale: string, code: string): string {
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") {
    return code.toUpperCase()
  }
  const displayNames = new Intl.DisplayNames([locale], { type: "region" })
  return displayNames.of(code.toUpperCase()) || code.toUpperCase()
}

export function listAllRegions(locale = "en"): RegionOption[] {
  const cached = regionCache.get(locale)
  if (cached) return cached

  const rawCodes = getSupportedRegionCodes()
  const deduped = new Set(rawCodes.map((code) => code.toLowerCase()))
  const options = [...deduped].map((code) => ({
    code,
    name: toDisplayName(locale, code),
  }))

  options.sort((left, right) => left.name.localeCompare(right.name))
  const withAll = [
    ALL_REGION_OPTION,
    ...options.filter((option) => option.code !== ALL_REGION_OPTION.code),
  ]
  regionCache.set(locale, withAll)
  return withAll
}

export function isLikelyRegionCode(value: string): boolean {
  const normalized = (value || "").trim().toLowerCase()
  if (normalized === ALL_REGION_OPTION.code) return true
  return /^[a-z]{2}$/i.test(normalized)
}
