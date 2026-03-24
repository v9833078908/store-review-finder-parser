"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, AlertCircle, MessageSquare, Bell, Search, BarChart3 } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { isSearchAppHomePath } from "@/lib/base-path"
import { useDashboardPreferences } from "@/lib/dashboard-preferences"
import { getUiText } from "@/lib/i18n"

const navItems = [
  { key: "searchApp",    href: "/",              icon: Search },
  { key: "commandCenter", href: "/command-center", icon: LayoutDashboard },
  { key: "issues",       href: "/issues",         icon: AlertCircle },
  { key: "reviews",      href: "/reviews",        icon: MessageSquare },
  { key: "alerts",       href: "/alerts",         icon: Bell },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { locale } = useDashboardPreferences()
  const text = getUiText(locale)

  if (isSearchAppHomePath(pathname)) {
    return null
  }

  return (
    <Sidebar>
      <SidebarContent>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 shadow-sm">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold tracking-tight">{text.appLabel}</span>
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.href}
                        className={isActive ? "font-semibold text-amber-700" : ""}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-amber-600" : ""}`} />
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
