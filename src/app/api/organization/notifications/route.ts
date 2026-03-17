import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  newProcess: z.object({ email: z.boolean(), push: z.boolean() }).optional(),
  statusChange: z.object({ email: z.boolean(), push: z.boolean() }).optional(),
  deadlineReminder: z.object({ email: z.boolean(), push: z.boolean() }).optional(),
  frequency: z.enum(["immediate", "daily", "weekly"]).optional(),
})

export type NotificationPreferences = z.infer<typeof schema>

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { notificationSettings: true },
  })

  const defaults: NotificationPreferences = {
    newProcess: { email: true, push: false },
    statusChange: { email: true, push: false },
    deadlineReminder: { email: true, push: false },
    frequency: "immediate",
  }

  return NextResponse.json({ preferences: org?.notificationSettings ?? defaults })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { notificationSettings: true },
  })
  const current = (org?.notificationSettings ?? {}) as NotificationPreferences

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: { notificationSettings: { ...current, ...parsed.data } },
    select: { notificationSettings: true },
  })

  return NextResponse.json({ preferences: updated.notificationSettings })
}
