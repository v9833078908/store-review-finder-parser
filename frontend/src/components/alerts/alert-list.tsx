"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import type { Alert } from "@/lib/types"
import { alertSeverityColor, formatDateTime, statusColor } from "@/lib/utils"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatAlertSeverity, formatAlertStatus, getUiText } from "@/lib/i18n"

interface AlertListProps {
  alerts: Alert[]
}

const alertIcons = {
  new_cluster: AlertCircle,
  spike: TrendingUp,
  rating_drop: TrendingDown,
  region_outbreak: MapPin,
}

export function AlertList({ alerts }: AlertListProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const Icon = alertIcons[alert.type]
        return (
          <Card key={alert.id}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-muted p-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{alert.title}</h3>
                        <Badge className={alertSeverityColor(alert.severity)}>
                          {formatAlertSeverity(alert.severity, locale)}
                        </Badge>
                        <Badge className={statusColor(alert.status)}>
                          {formatAlertStatus(alert.status, locale)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(alert.detectedAt, locale)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{text.alertList.metric}:</span>
                      <span className="font-mono font-medium">{alert.metric}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{text.alertList.baseline}:</span>
                      <span className="font-mono">{alert.baseline}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{text.alertList.current}:</span>
                      <span className="font-mono font-medium text-destructive">
                        {alert.current}
                      </span>
                    </div>
                  </div>

                  {alert.clusterId && (
                    <div className="pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/issues/${alert.clusterId}`}>
                          {text.alertList.viewRelatedCluster}
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
