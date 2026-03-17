import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string
  const { id } = await params

  const cpc = await prisma.orgCpcCode.findFirst({ where: { id, orgId } })
  if (!cpc) return NextResponse.json({ error: "Código CPC no encontrado" }, { status: 404 })

  await prisma.orgCpcCode.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
