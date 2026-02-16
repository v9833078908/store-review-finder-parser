import { NextRequest } from "next/server"
import { getBackendUrl } from "@/lib/server-backend-url"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const url = new URL(`${getBackendUrl()}/api/report`)
  url.search = request.nextUrl.search

  const upstream = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "text/event-stream",
    },
  })

  if (!upstream.body) {
    return new Response("Missing upstream SSE stream", { status: 502 })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
