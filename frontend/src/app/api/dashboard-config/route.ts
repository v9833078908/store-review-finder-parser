import { NextRequest } from "next/server"

import { getBackendUrl } from "@/lib/server-backend-url"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const url = new URL(`${getBackendUrl()}/api/dashboard-config`)
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

export async function PUT(request: NextRequest) {
  const url = new URL(`${getBackendUrl()}/api/dashboard-config`)
  url.search = request.nextUrl.search

  const body = await request.text()
  const upstream = await fetch(url.toString(), {
    method: "PUT",
    cache: "no-store",
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    body,
  })

  const upstreamBody = await upstream.text()
  return new Response(upstreamBody, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  })
}
