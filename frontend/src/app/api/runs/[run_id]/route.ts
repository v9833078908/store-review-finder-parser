import { NextRequest } from "next/server"
import { getBackendUrl } from "@/lib/server-backend-url"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> },
) {
  const { run_id } = await params
  const url = new URL(`${getBackendUrl()}/api/runs/${encodeURIComponent(run_id)}`)
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
