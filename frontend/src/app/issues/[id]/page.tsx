"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ClusterDetail } from "@/components/issues/cluster-detail"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

export default function ClusterDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, loading, error } = useDashboardData()
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)
  const id = params?.id || ""
  const cluster = data.clusters.find((item) => item.id === id)
  const clusterReviews = cluster ? data.reviews.filter((review) => cluster.reviewIds.includes(review.id)) : []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/issues">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {text.common.backToIssues}
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">{text.common.loadingClusterDetails}</div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {cluster ? (
        <ClusterDetail cluster={cluster} reviews={clusterReviews} />
      ) : (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          {text.common.clusterNotFound}: <code>{id}</code>
        </div>
      )}
    </div>
  )
}
