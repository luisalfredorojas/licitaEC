import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const followSchema = z.object({
  internalStatus: z.enum(["INTERESTED", "PREPARING", "SUBMITTED", "WON", "LOST", "DISCARDED"]).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ocid: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const userId = session.user.id as string
  const { ocid } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = followSchema.safeParse(body)
  const internalStatus = parsed.success ? (parsed.data.internalStatus ?? "INTERESTED") : "INTERESTED"

  const process = await prisma.procurementProcess.findUnique({
    where: { ocid },
    select: { id: true },
  })
  if (!process) return NextResponse.json({ error: "Process not found" }, { status: 404 })

  const tracking = await prisma.processTracking.upsert({
    where: { orgId_processId: { orgId, processId: process.id } },
    create: {
      orgId,
      processId: process.id,
      internalStatus,
      assignedToId: userId,
    },
    update: { internalStatus },
  })

  return NextResponse.json(tracking, { status: 201 })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ocid: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const { ocid } = await params

  const process = await prisma.procurementProcess.findUnique({
    where: { ocid },
    select: { id: true },
  })
  if (!process) return NextResponse.json({ error: "Process not found" }, { status: 404 })

  await prisma.processTracking.deleteMany({
    where: { orgId, processId: process.id },
  })

  return NextResponse.json({ success: true })
}
