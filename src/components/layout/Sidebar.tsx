"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Bell, GitBranch, BarChart2, Settings, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  badgeKey?: "unreadAlerts" | "newContracts"
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Contratos", href: "/contratos", icon: FileText, badgeKey: "newContracts" },
  { label: "Alertas", href: "/alertas", icon: Bell, badgeKey: "unreadAlerts" },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Configuración", href: "/configuracion", icon: Settings },
]

type SidebarProps = {
  orgName: string
  plan: string
  userName: string
  unreadAlerts?: number
  newContracts?: number
  lastSync?: Date | null
  onClose?: () => void
}

export function Sidebar({
  orgName, plan, userName, unreadAlerts = 0, newContracts = 0, lastSync, onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const badges = { unreadAlerts, newContracts }

  const planLabel: Record<string, string> = {
    BASIC: "Básico",
    PROFESSIONAL: "Profesional",
    ENTERPRISE: "Empresa",
  }

  const lastSyncLabel = () => {
    if (!lastSync) return "Sin sincronizar"
    const diffMs = Date.now() - new Date(lastSync).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Hace menos de 1 min"
    if (diffMin < 60) return `Hace ${diffMin} min`
    return `Hace ${Math.floor(diffMin / 60)}h`
  }

  return (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-700">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">L</div>
          <span className="font-semibold text-lg">LicitaEC</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0 min-w-[20px] justify-center">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-gray-700 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Última sync: {lastSyncLabel()}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
            {(userName || orgName || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{orgName}</p>
            <p className="text-xs text-gray-400">{planLabel[plan] ?? plan}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
