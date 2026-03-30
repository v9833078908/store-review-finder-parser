const APP_STORE_ID_RE = /^\d+$/
const APP_STORE_URL_ID_RE = /\/id(\d+)(?:[/?#]|$)/

export function extractAppStoreId(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (APP_STORE_ID_RE.test(trimmed)) return trimmed
  const match = trimmed.match(APP_STORE_URL_ID_RE)
  return match ? match[1] : null
}

export function isAppStoreInputValid(value: string): boolean {
  return extractAppStoreId(value) !== null
}

export function toAppStoreUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const appId = extractAppStoreId(trimmed)
  return appId ? `https://apps.apple.com/app/id${appId}` : null
}
