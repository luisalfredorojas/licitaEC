import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const cpcCodes = await prisma.orgCpcCode.findMany({
    where: { orgId },
    orderBy: { addedAt: "desc" },
    select: { id: true, cpcCode: true, cpcDescription: true, addedAt: true },
  })

  return NextResponse.json({ cpcCodes })
}
