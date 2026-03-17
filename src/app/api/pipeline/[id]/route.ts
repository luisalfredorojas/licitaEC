import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasPlan, planError } from "@/lib/plan-guard"
import { SubscriptionPlan } from "@prisma/client"
import { z } from "zod"

const patchSchema = z.object({
  internalStatus: z
    .enum(["INTERESTED", "PREPARING", "SUBMITTED", "WON", "LOST", "DISCARDED"])
    .optional(),
  notes: z.string().optional(),
  bidAmount: z.number().positive().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  decisionDate: z.string().datetime().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string
  const plan = user.plan as SubscriptionPlan
  const { id } = await params

  if (!hasPlan(plan, "PROFESSIONAL")) return planError("PROFESSIONAL")

  const tracking = await prisma.processTracking.findFirst({
    where: { id, orgId },
  })
  if (!tracking) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { internalStatus, notes, bidAmount, assignedToId, decisionDate } = parsed.data

  const updated = await prisma.processTracking.update({
    where: { id },
    data: {
      ...(internalStatus !== undefined && { internalStatus }),
      ...(notes !== undefined && { notes }),
      ...(bidAmount !== undefined && { bidAmount: bidAmount ?? null }),
      ...(assignedToId !== undefined && { assignedToId: assignedToId ?? null }),
      ...(decisionDate !== undefined && { decisionDate: decisionDate ? new Date(decisionDate) : null }),
    },
    include: {
      process: { select: { ocid: true, title: true, amountEstimated: true, tenderEndDate: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({
    ...updated,
    bidAmount: updated.bidAmount ? Number(updated.bidAmount) : null,
    process: {
      ...updated.process,
      amountEstimated: updated.process.amountEstimated ? Number(updated.process.amountEstimated) : null,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const { id } = await params

  const tracking = await prisma.processTracking.findFirst({ where: { id, orgId } })
  if (!tracking) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.processTracking.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
