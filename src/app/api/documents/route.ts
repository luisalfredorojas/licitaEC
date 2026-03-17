import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const processId = req.nextUrl.searchParams.get("processId")

  if (!processId) return NextResponse.json({ error: "processId requerido" }, { status: 400 })

  const documents = await prisma.bidDocument.findMany({
    where: { orgId, processId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      documentType: true,
      uploadedAt: true,
    },
  })

  return NextResponse.json({ documents })
}
