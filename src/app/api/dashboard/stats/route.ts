import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Get org CPC codes
  const orgCpcs = await prisma.orgCpcCode.findMany({
    where: { orgId },
    select: { cpcCode: true },
  })
  const cpcCodes = orgCpcs.map((c) => c.cpcCode)

  // Run all counts in parallel
  const [nuevosHoy, porVencer, enPipeline, alertasSinLeer, lastSync] = await Promise.all([
    // Nuevos hoy — processes published in last 24h matching org CPCs
    cpcCodes.length > 0
      ? prisma.procurementProcess.count({
          where: {
            publishedDate: { gte: yesterday },
            cpcCodes: { hasSome: cpcCodes },
          },
        })
      : 0,

    // Por vencer esta semana — TENDER status with end date in next 7 days matching CPCs
    cpcCodes.length > 0
      ? prisma.procurementProcess.count({
          where: {
            status: "TENDER",
            tenderEndDate: { gte: now, lte: nextWeek },
            cpcCodes: { hasSome: cpcCodes },
          },
        })
      : 0,

    // En pipeline
    prisma.processTracking.count({ where: { orgId } }),

    // Alertas sin leer
    prisma.alert.count({ where: { orgId, isRead: false } }),

    // Last sync
    prisma.syncLog.findFirst({
      where: { status: "success" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ])

  return NextResponse.json({
    nuevosHoy,
    porVencer,
    enPipeline,
    alertasSinLeer,
    lastSync: lastSync?.completedAt ?? null,
  })
}
