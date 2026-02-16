"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"

interface ProgressPanelProps {
  current: number
  total: number
  currentApp: string
  startTime: number | null
}

export function ProgressPanel({ current, total, currentApp, startTime }: ProgressPanelProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const progress = total > 0 ? (current / total) * 100 : 0
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Processing {current} of {total} apps</p>
          <p className="text-xs text-muted-foreground">{currentApp || "Preparing..."}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </div>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
