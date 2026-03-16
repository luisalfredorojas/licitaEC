import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const { searchParams } = req.nextUrl

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))
  const unreadOnly = searchParams.get("unreadOnly") === "true"

  const skip = (page - 1) * limit

  const where = {
    orgId,
    ...(unreadOnly ? { isRead: false } : {}),
  }

  const [total, items] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        process: {
          select: {
            ocid: true,
            title: true,
            buyerName: true,
            status: true,
            procurementMethod: true,
            amountEstimated: true,
            tenderEndDate: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    items: items.map((a) => ({
      ...a,
      process: {
        ...a.process,
        amountEstimated: a.process.amountEstimated ? Number(a.process.amountEstimated) : null,
      },
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    unreadCount: unreadOnly ? total : await prisma.alert.count({ where: { orgId, isRead: false } }),
  })
}
