"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Bell, BellOff, CheckCheck, FileText, Clock, TrendingUp, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDateRelative } from "@/lib/utils"
import { cn } from "@/lib/utils"

type AlertItem = {
  id: string
  alertType: string
  isRead: boolean
  matchedCpcCode: string | null
  createdAt: string
  process: {
    ocid: string
    title: string
    buyerName: string
    status: string
    procurementMethod: string
    amountEstimated: number | null
    tenderEndDate: string | null
  }
}

type AlertsResponse = {
  items: AlertItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  unreadCount: number
}

const alertTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  NEW_PROCESS: { label: "Nuevo proceso", icon: FileText, color: "text-blue-600" },
  DEADLINE_REMINDER: { label: "Plazo próximo", icon: Clock, color: "text-orange-600" },
  STATUS_CHANGE: { label: "Cambio de estado", icon: TrendingUp, color: "text-purple-600" },
  AWARDED: { label: "Adjudicado", icon: Award, color: "text-green-600" },
}

function groupByDay(alerts: AlertItem[]): Record<string, AlertItem[]> {
  const groups: Record<string, AlertItem[]> = {}
  const now = new Date()

  for (const alert of alerts) {
    const date = new Date(alert.createdAt)
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

    let key: string
    if (diffDays === 0) key = "Hoy"
    else if (diffDays === 1) key = "Ayer"
    else if (diffDays < 7) key = "Esta semana"
    else key = "Anteriores"

    if (!groups[key]) groups[key] = []
    groups[key]!.push(alert)
  }
  return groups
}

const GROUP_ORDER = ["Hoy", "Ayer", "Esta semana", "Anteriores"]

export function AlertasView() {
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<AlertsResponse>({
    queryKey: ["alertas", page, unreadOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), unreadOnly: String(unreadOnly) })
      const res = await fetch(`/api/alertas?${params}`)
      if (!res.ok) throw new Error("Error fetching alerts")
      return res.json()
    },
    staleTime: 10_000,
  })

  const markAsRead = async (id: string) => {
    await fetch(`/api/alertas/${id}/read`, { method: "PATCH" })
    queryClient.invalidateQueries({ queryKey: ["alertas"] })
    queryClient.invalidateQueries({ queryKey: ["sidebar-stats"] })
  }

  const markAllAsRead = async () => {
    await fetch("/api/alertas/read-all", { method: "PATCH" })
    queryClient.invalidateQueries({ queryKey: ["alertas"] })
    queryClient.invalidateQueries({ queryKey: ["sidebar-stats"] })
  }

  const totalPages = data?.pagination.totalPages ?? 1
  const unreadCount = data?.unreadCount ?? 0
  const groups = groupByDay(data?.items ?? [])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alertas</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {unreadCount} alerta{unreadCount !== 1 ? "s" : ""} sin leer
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => { setUnreadOnly(!unreadOnly); setPage(1) }}
          >
            {unreadOnly ? <Bell className="h-4 w-4 mr-1.5" /> : <BellOff className="h-4 w-4 mr-1.5" />}
            {unreadOnly ? "Solo sin leer" : "Todas"}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="h-14 w-14 text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium text-lg">Sin alertas</p>
          <p className="text-sm text-gray-400 mt-1">
            {unreadOnly ? "No tienes alertas sin leer" : "Las alertas aparecerán aquí cuando haya coincidencias con tus CPC"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.filter((g) => (groups[g]?.length ?? 0) > 0).map((groupName) => (
            <div key={groupName}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {groupName}
              </p>
              <div className="bg-white border rounded-xl divide-y overflow-hidden">
                {(groups[groupName] ?? []).map((alert) => {
                  const config = alertTypeConfig[alert.alertType] ?? { label: "Nuevo proceso", icon: FileText, color: "text-blue-600" }
                  const Icon = config.icon
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        "flex items-start gap-4 p-4 transition-colors",
                        !alert.isRead && "bg-blue-50/60"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn("mt-0.5 p-2 rounded-lg shrink-0", !alert.isRead ? "bg-blue-100" : "bg-gray-100")}>
                        <Icon className={cn("h-4 w-4", !alert.isRead ? config.color : "text-gray-500")} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("text-xs font-semibold", config.color)}>
                                {config.label}
                              </span>
                              {alert.matchedCpcCode && (
                                <Badge variant="outline" className="text-xs">
                                  CPC {alert.matchedCpcCode}
                                </Badge>
                              )}
                              {!alert.isRead && (
                                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                              )}
                            </div>
                            <Link
                              href={`/contratos/${alert.process.ocid}`}
                              className="text-sm font-medium text-gray-900 hover:text-blue-700 hover:underline line-clamp-2 mt-0.5 block"
                              onClick={() => !alert.isRead && markAsRead(alert.id)}
                            >
                              {alert.process.title}
                            </Link>
                            <p className="text-xs text-gray-500 mt-0.5">{alert.process.buyerName}</p>
                            {alert.process.amountEstimated && (
                              <p className="text-xs text-gray-500">
                                {formatCurrency(alert.process.amountEstimated)}
                                {alert.process.tenderEndDate && (
                                  <span> · Plazo: {new Date(alert.process.tenderEndDate).toLocaleDateString("es-EC")}</span>
                                )}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 shrink-0">
                            {formatDateRelative(alert.createdAt)}
                          </p>
                        </div>

                        {!alert.isRead && (
                          <button
                            onClick={() => markAsRead(alert.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 mt-1.5 font-medium"
                          >
                            Marcar como leída
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <p className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
