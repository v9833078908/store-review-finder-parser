import { NextRequest } from "next/server"
import { getBackendUrl } from "@/lib/server-backend-url"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const url = new URL(`${getBackendUrl()}/api/resolve/app-store`)
  url.search = request.nextUrl.search

  const upstream = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  })

  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  })
}
