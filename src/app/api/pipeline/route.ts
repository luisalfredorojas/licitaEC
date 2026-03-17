import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPlan, planError } from "@/lib/plan-guard"
import { SubscriptionPlan } from "@prisma/client"
import { z } from "zod"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string
  const plan = user.plan as SubscriptionPlan

  if (!hasPlan(plan, "PROFESSIONAL")) return planError("PROFESSIONAL")

  const tracking = await prisma.processTracking.findMany({
    where: { orgId },
    include: {
      process: {
        select: {
          id: true,
          ocid: true,
          title: true,
          buyerName: true,
          amountEstimated: true,
          tenderEndDate: true,
          status: true,
          procurementMethod: true,
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const grouped = {
    INTERESTED: [] as typeof tracking,
    PREPARING: [] as typeof tracking,
    SUBMITTED: [] as typeof tracking,
    WON: [] as typeof tracking,
    LOST: [] as typeof tracking,
    DISCARDED: [] as typeof tracking,
  }

  for (const item of tracking) {
    if (item.internalStatus in grouped) {
      grouped[item.internalStatus as keyof typeof grouped].push(item)
    }
  }

  // Calculate total amounts in play (INTERESTED + PREPARING + SUBMITTED)
  const inPlay = [...grouped.INTERESTED, ...grouped.PREPARING, ...grouped.SUBMITTED]
  const totalInPlay = inPlay.reduce((sum, t) => {
    const amount = t.bidAmount
      ? Number(t.bidAmount)
      : t.process.amountEstimated
      ? Number(t.process.amountEstimated)
      : 0
    return sum + amount
  }, 0)

  // Vence esta semana
  const oneWeekFromNow = new Date()
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
  const venceEstaSemana = inPlay.filter(
    (t) => t.process.tenderEndDate && new Date(t.process.tenderEndDate) <= oneWeekFromNow
  )

  return NextResponse.json({
    columns: Object.fromEntries(
      Object.entries(grouped).map(([status, items]) => [
        status,
        items.map((t) => ({
          ...t,
          bidAmount: t.bidAmount ? Number(t.bidAmount) : null,
          process: {
            ...t.process,
            amountEstimated: t.process.amountEstimated ? Number(t.process.amountEstimated) : null,
          },
        })),
      ])
    ),
    summary: {
      totalInPlay,
      countPerColumn: Object.fromEntries(
        Object.entries(grouped).map(([status, items]) => [status, items.length])
      ),
      venceEstaSemana: venceEstaSemana.map((t) => ({
        id: t.id,
        title: t.process.title,
        ocid: t.process.ocid,
        tenderEndDate: t.process.tenderEndDate,
      })),
    },
  })
}

const addSchema = z.object({
  ocid: z.string().min(1),
  internalStatus: z
    .enum(["INTERESTED", "PREPARING", "SUBMITTED", "WON", "LOST", "DISCARDED"])
    .default("INTERESTED"),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string
  const plan = user.plan as SubscriptionPlan

  if (!hasPlan(plan, "PROFESSIONAL")) return planError("PROFESSIONAL")

  const body = await req.json().catch(() => ({}))
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { ocid, internalStatus } = parsed.data

  const process = await prisma.procurementProcess.findUnique({
    where: { ocid },
    select: { id: true },
  })
  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  const tracking = await prisma.processTracking.upsert({
    where: { orgId_processId: { orgId, processId: process.id } },
    create: { orgId, processId: process.id, internalStatus, assignedToId: user.id },
    update: { internalStatus },
  })

  return NextResponse.json(tracking, { status: 201 })
}
