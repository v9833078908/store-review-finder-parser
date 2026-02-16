"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ActionItem } from "@/lib/types"
import { statusColor, formatDate } from "@/lib/utils"
import { Bug, FileText, MessageSquare, AlertOctagon, Search } from "lucide-react"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { formatActionStatus, getUiText } from "@/lib/i18n"

interface ActionBoardProps {
  actions: ActionItem[]
}

const actionIcons = {
  hotfix: Bug,
  faq: FileText,
  reply_template: MessageSquare,
  escalation: AlertOctagon,
  investigation: Search,
}

export function ActionBoard({ actions }: ActionBoardProps) {
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.actionBoard.title}</CardTitle>
        <CardDescription>{text.actionBoard.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{text.actionBoard.action}</TableHead>
              <TableHead>{text.actionBoard.owner}</TableHead>
              <TableHead>{text.actionBoard.status}</TableHead>
              <TableHead>{text.actionBoard.nextCheck}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => {
              const Icon = actionIcons[action.type]
              return (
                <TableRow key={action.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{action.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {action.owner}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(action.status)}>
                      {formatActionStatus(action.status, locale)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(action.nextCheckAt, locale)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
