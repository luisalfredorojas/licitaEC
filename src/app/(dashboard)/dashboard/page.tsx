import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate, formatDateRelative } from "@/lib/utils"
import { FileText, Bell, GitBranch, Calendar, TrendingUp, Settings } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const orgCpcs = await prisma.orgCpcCode.findMany({
    where: { orgId },
    select: { cpcCode: true },
  })
  const cpcCodes = orgCpcs.map((c) => c.cpcCode)

  const [nuevosHoy, porVencer, enPipeline, alertasSinLeer, recientes, recentAlerts] =
    await Promise.all([
      cpcCodes.length > 0
        ? prisma.procurementProcess.count({
            where: { publishedDate: { gte: yesterday }, cpcCodes: { hasSome: cpcCodes } },
          })
        : 0,

      cpcCodes.length > 0
        ? prisma.procurementProcess.count({
            where: {
              status: "TENDER",
              tenderEndDate: { gte: now, lte: nextWeek },
              cpcCodes: { hasSome: cpcCodes },
            },
          })
        : 0,

      prisma.processTracking.count({ where: { orgId } }),

      prisma.alert.count({ where: { orgId, isRead: false } }),

      // Latest 10 matching processes
      cpcCodes.length > 0
        ? prisma.procurementProcess.findMany({
            where: { cpcCodes: { hasSome: cpcCodes } },
            orderBy: { publishedDate: "desc" },
            take: 10,
            select: {
              ocid: true,
              title: true,
              buyerName: true,
              amountEstimated: true,
              tenderEndDate: true,
              status: true,
              procurementMethod: true,
              ocpMethodType: true,
            },
          })
        : [],

      // Latest 5 alerts
      prisma.alert.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          process: { select: { ocid: true, title: true, buyerName: true } },
        },
      }),
    ])

  const statusBadge: Record<string, { label: string; className: string }> = {
    PLANNING: { label: "Planificación", className: "bg-gray-100 text-gray-700" },
    TENDER: { label: "Activo", className: "bg-yellow-100 text-yellow-800" },
    AWARD: { label: "Adjudicado", className: "bg-green-100 text-green-800" },
    CONTRACT: { label: "Contrato", className: "bg-blue-100 text-blue-800" },
    CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-700" },
  }

  const ocpBadge: Record<string, { label: string; className: string }> = {
    OPEN: { label: "OPEN", className: "bg-green-100 text-green-700" },
    SELECTIVE: { label: "SELECTIVE", className: "bg-blue-100 text-blue-700" },
    LIMITED: { label: "LIMITED", className: "bg-purple-100 text-purple-700" },
    DIRECT: { label: "DIRECT", className: "bg-gray-100 text-gray-600" },
  }

  const stats = [
    {
      label: "Contratos nuevos hoy",
      value: nuevosHoy,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      desc: "Publicados en las últimas 24h",
    },
    {
      label: "Por vencer esta semana",
      value: porVencer,
      icon: Calendar,
      color: "text-orange-600",
      bg: "bg-orange-50",
      desc: "Plazo en los próximos 7 días",
    },
    {
      label: "En mi pipeline",
      value: enPipeline,
      icon: GitBranch,
      color: "text-purple-600",
      bg: "bg-purple-50",
      desc: "Oportunidades en seguimiento",
    },
    {
      label: "Alertas sin leer",
      value: alertasSinLeer,
      icon: Bell,
      color: "text-red-600",
      bg: "bg-red-50",
      desc: "Notificaciones pendientes",
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Bienvenido, {session.user.name ?? session.user.email}
        </h2>
        <p className="text-gray-500 mt-1">
          {cpcCodes.length === 0
            ? "Configura tus códigos CPC para ver oportunidades personalizadas."
            : `Monitoreando ${cpcCodes.length} código${cpcCodes.length !== 1 ? "s" : ""} CPC`}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.desc}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent opportunities feed */}
        <div className="xl:col-span-2">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Oportunidades recientes</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/contratos">Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recientes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <TrendingUp className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No hay oportunidades aún</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {cpcCodes.length === 0
                      ? "Configura tus códigos CPC para recibir alertas"
                      : "Los contratos aparecerán aquí cuando se publiquen"}
                  </p>
                  {cpcCodes.length === 0 && (
                    <Button className="mt-4" size="sm" asChild>
                      <Link href="/configuracion">
                        <Settings className="h-4 w-4 mr-2" />
                        Configurar CPC
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {recientes.map((p) => {
                    const sb = statusBadge[p.status] ?? { label: "Planificación", className: "bg-gray-100 text-gray-700" }
                    const ob = ocpBadge[p.ocpMethodType] ?? { label: "OPEN", className: "bg-green-100 text-green-700" }
                    return (
                      <Link
                        key={p.ocid}
                        href={`/contratos/${p.ocid}`}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{p.buyerName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ob.className}`}>
                            {ob.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.className}`}>
                            {sb.label}
                          </span>
                          {p.amountEstimated && (
                            <span className="text-sm font-semibold text-gray-900 hidden sm:block">
                              {formatCurrency(Number(p.amountEstimated))}
                            </span>
                          )}
                          {p.tenderEndDate && (
                            <span className="text-xs text-gray-400 hidden md:block">
                              {formatDate(p.tenderEndDate)}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent alerts panel */}
        <div>
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Actividad reciente</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/alertas">Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Bell className="h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">Sin actividad reciente</p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentAlerts.map((alert) => {
                    const alertTypeLabel: Record<string, string> = {
                      NEW_PROCESS: "Nuevo proceso",
                      DEADLINE_REMINDER: "Plazo próximo",
                      STATUS_CHANGE: "Cambio de estado",
                      AWARDED: "Adjudicado",
                    }
                    return (
                      <Link
                        key={alert.id}
                        href={`/contratos/${alert.process.ocid}`}
                        className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                          !alert.isRead ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!alert.isRead && (
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1" style={alert.isRead ? { paddingLeft: "16px" } : {}}>
                            <p className="text-xs font-medium text-blue-600">
                              {alertTypeLabel[alert.alertType] ?? alert.alertType}
                            </p>
                            <p className="text-sm text-gray-900 truncate mt-0.5">
                              {alert.process.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDateRelative(alert.createdAt)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
