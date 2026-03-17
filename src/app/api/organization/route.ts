import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  rupCode: z.string().max(20).nullable().optional(),
})

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      ruc: true,
      rupCode: true,
      plan: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  })

  return NextResponse.json(org)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden editar la organización" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: parsed.data,
    select: { id: true, name: true, ruc: true, rupCode: true },
  })

  return NextResponse.json(updated)
}
