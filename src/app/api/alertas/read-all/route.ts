import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const result = await prisma.alert.updateMany({
    where: { orgId, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ success: true, updated: result.count })
}
