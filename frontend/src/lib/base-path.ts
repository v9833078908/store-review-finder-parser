const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || ""

function normalizeBasePath(value: string): string {
  if (!value || value === "/") return ""
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

export const BASE_PATH = normalizeBasePath(rawBasePath)

export function withBasePath(path: string): string {
  if (!path) return BASE_PATH || "/"
  if (/^https?:\/\//.test(path)) return path

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  if (!BASE_PATH) return normalizedPath
  if (normalizedPath === BASE_PATH || normalizedPath.startsWith(`${BASE_PATH}/`)) return normalizedPath
  if (normalizedPath === "/") return BASE_PATH
  return `${BASE_PATH}${normalizedPath}`
}

export function apiPath(path: string): string {
  return withBasePath(path)
}

export function browserUrl(path: string): URL {
  return new URL(withBasePath(path), window.location.origin)
}

export function isSearchAppHomePath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === "/" || pathname === "/search-app" || pathname === BASE_PATH
}
