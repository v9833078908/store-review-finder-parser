"use client"

import { useEffect, useMemo, useState } from "react"
import { buildCommunityPulseStats, buildCommunityThreads, buildSourceComparison, mapCommunityToReviews } from "@/lib/community-mapper"
import type { CommunityDataFile } from "@/lib/community-types"
import type { CommunityPulseStats, CommunityThread, Review, SourceComparisonStats } from "@/lib/types"

interface CommunityProcessedData {
  communityReviews: Review[]
  communityPulse: CommunityPulseStats | null
  communityThreads: CommunityThread[]
  sourceComparison: SourceComparisonStats | null
}

interface CommunityHookState extends CommunityProcessedData {
  loading: boolean
  error: string | null
}

let cachedCommunityPayload: CommunityDataFile | null = null
let cachedCommunityPromise: Promise<CommunityDataFile> | null = null

let cachedPackage: string | null = null

async function fetchCommunityPayload(packageName: string): Promise<CommunityDataFile> {
  if (cachedCommunityPayload && cachedPackage === packageName) return cachedCommunityPayload
  if (cachedCommunityPromise && cachedPackage === packageName) return cachedCommunityPromise

  cachedPackage = packageName
  cachedCommunityPromise = fetch(`/api/community?package=${encodeURIComponent(packageName)}`, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Community API returned ${response.status}`)
    }
    const payload = (await response.json()) as CommunityDataFile
    cachedCommunityPayload = payload
    return payload
  })

  try {
    return await cachedCommunityPromise
  } catch {
    cachedPackage = null
    throw new Error("No community data")
  } finally {
    cachedCommunityPromise = null
  }
}

export async function fetchCommunityDataFile(packageName: string): Promise<CommunityDataFile> {
  return fetchCommunityPayload(packageName)
}

export function mapCommunityBundle(
  payload: CommunityDataFile,
  productId: string,
  googlePlayReviews: Review[],
): CommunityProcessedData {
  const communityReviews = mapCommunityToReviews(payload, productId)
  const communityPulse = buildCommunityPulseStats(payload, communityReviews)
  const communityThreads = buildCommunityThreads(payload.classified || [])
  const sourceComparison = buildSourceComparison(googlePlayReviews, communityReviews)

  return {
    communityReviews,
    communityPulse,
    communityThreads,
    sourceComparison,
  }
}

export function useCommunityData(googlePlayReviews: Review[], productId: string) {
  const [payload, setPayload] = useState<CommunityDataFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const nextPayload = await fetchCommunityPayload(productId)
        if (!active) return
        setPayload(nextPayload)
      } catch (reason) {
        if (!active) return
        setError(reason instanceof Error ? reason.message : "Failed to load community data")
      } finally {
        if (active) setLoading(false)
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [productId])

  const mapped = useMemo<CommunityProcessedData>(() => {
    if (!payload) {
      return {
        communityReviews: [],
        communityPulse: null,
        communityThreads: [],
        sourceComparison: null,
      }
    }

    return mapCommunityBundle(payload, productId, googlePlayReviews)
  }, [googlePlayReviews, payload, productId])

  return {
    ...mapped,
    loading,
    error,
  } satisfies CommunityHookState
}
