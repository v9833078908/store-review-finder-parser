import { NextRequest } from "next/server"
import { getBackendUrl } from "@/lib/server-backend-url"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const upstream = await fetch(`${getBackendUrl()}/api/report/multi/sync`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    body: await request.text(),
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
