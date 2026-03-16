"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { useSidebarStats } from "@/hooks/useSidebarStats"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contratos": "Contratos",
  "/alertas": "Alertas",
  "/pipeline": "Pipeline",
  "/analytics": "Analytics",
  "/configuracion": "Configuración",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  const { stats } = useSidebarStats()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any
  const orgName = (user?.orgName as string | undefined) ?? user?.name ?? "Mi Empresa"
  const plan = user?.plan ?? "BASIC"
  const userName = user?.name ?? user?.email ?? ""

  const pageTitle = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + "/")
  )?.[1] ?? "Dashboard"

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-10">
        <Sidebar
          orgName={orgName}
          plan={plan}
          userName={userName}
          unreadAlerts={stats?.alertasSinLeer ?? 0}
          newContracts={stats?.nuevosHoy ?? 0}
          lastSync={stats?.lastSync}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar
            orgName={orgName}
            plan={plan}
            userName={userName}
            unreadAlerts={stats?.alertasSinLeer ?? 0}
            newContracts={stats?.nuevosHoy ?? 0}
            lastSync={stats?.lastSync}
            onClose={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col flex-1 lg:pl-64 min-w-0">
        <Navbar
          pageTitle={pageTitle}
          userName={user?.name}
          userEmail={user?.email}
          unreadAlerts={stats?.alertasSinLeer ?? 0}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
