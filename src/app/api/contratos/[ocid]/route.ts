import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
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
    include: {
      tracking: {
        where: { orgId },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
      },
      documents: { where: { orgId } },
    },
  })

  if (!process) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...process,
    amountEstimated: process.amountEstimated ? Number(process.amountEstimated) : null,
    amountAwarded: process.amountAwarded ? Number(process.amountAwarded) : null,
    tracking: process.tracking[0] ?? null,
    documents: process.documents,
  })
}
