import { existsSync, promises as fs } from "node:fs"
import path from "node:path"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

const INDEX_FILE = "community-index.json"

function resolveDataDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "../data"),
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "../../data"),
  ]
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, INDEX_FILE))) return candidate
  }
  return null
}

export async function GET(request: NextRequest) {
  const packageName = request.nextUrl.searchParams.get("package")
  if (!packageName) {
    return Response.json({ error: "Missing ?package= parameter" }, { status: 400 })
  }

  const dataDir = resolveDataDir()
  if (!dataDir) {
    return Response.json({ error: "Community index not found" }, { status: 404 })
  }

  try {
    const indexRaw = await fs.readFile(path.join(dataDir, INDEX_FILE), "utf-8")
    const index = JSON.parse(indexRaw) as Record<string, string>
    const fileName = index[packageName]
    if (!fileName) {
      return Response.json({ error: "No community data for this app" }, { status: 404 })
    }

    const filePath = path.join(dataDir, fileName)
    if (!existsSync(filePath)) {
      return Response.json({ error: "Community data file not found" }, { status: 404 })
    }

    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw)
    return Response.json(parsed, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        error: "Failed to read community data",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    )
  }
}
