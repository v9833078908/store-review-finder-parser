"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, AlertCircle, MessageSquare, Bell, Search } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

const navItems = [
  {
    key: "searchApp",
    href: "/search-app",
    icon: Search,
  },
  {
    key: "commandCenter",
    href: "/command-center",
    icon: LayoutDashboard,
  },
  {
    key: "issues",
    href: "/issues",
    icon: AlertCircle,
  },
  {
    key: "reviews",
    href: "/reviews",
    icon: MessageSquare,
  },
  {
    key: "alerts",
    href: "/alerts",
    icon: Bell,
  },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  if (pathname.startsWith("/search-app")) {
    return null
  }

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{text.appLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{text.nav[item.key]}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
