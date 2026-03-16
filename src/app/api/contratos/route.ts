import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma, ProcurementStatus, ProcurementMethod } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string
  const { searchParams } = req.nextUrl

  const q = searchParams.get("q") ?? ""
  const statusParam = searchParams.getAll("status[]")
  const provinceParam = searchParams.getAll("province[]")
  const methodParam = searchParams.getAll("method[]")
  const minAmount = searchParams.get("minAmount")
  const maxAmount = searchParams.get("maxAmount")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const myCpcOnly = searchParams.get("myCpcOnly") === "true"
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25")))
  const orderBy = searchParams.get("orderBy") ?? "publishedDate"
  const orderDir = (searchParams.get("orderDir") ?? "desc") as "asc" | "desc"

  const skip = (page - 1) * limit

  // Build where clause
  const where: Prisma.ProcurementProcessWhereInput = {}

  // Full-text search
  if (q.trim()) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { buyerName: { contains: q, mode: "insensitive" } },
    ]
  }

  // Status filter
  if (statusParam.length > 0) {
    where.status = { in: statusParam as ProcurementStatus[] }
  }

  // Province filter
  if (provinceParam.length > 0) {
    where.buyerProvince = { in: provinceParam, mode: "insensitive" }
  }

  // Method filter
  if (methodParam.length > 0) {
    where.procurementMethod = { in: methodParam as ProcurementMethod[] }
  }

  // Amount range
  if (minAmount || maxAmount) {
    where.amountEstimated = {}
    if (minAmount) where.amountEstimated.gte = new Prisma.Decimal(minAmount)
    if (maxAmount) where.amountEstimated.lte = new Prisma.Decimal(maxAmount)
  }

  // Date range
  if (dateFrom || dateTo) {
    where.publishedDate = {}
    if (dateFrom) where.publishedDate.gte = new Date(dateFrom)
    if (dateTo) where.publishedDate.lte = new Date(dateTo)
  }

  // My CPC only
  if (myCpcOnly) {
    const orgCpcs = await prisma.orgCpcCode.findMany({
      where: { orgId },
      select: { cpcCode: true },
    })
    const codes = orgCpcs.map((c) => c.cpcCode)
    if (codes.length > 0) {
      where.cpcCodes = { hasSome: codes }
    }
  }

  // Allowed sort fields
  const allowedOrderFields = ["publishedDate", "tenderEndDate", "amountEstimated", "title", "buyerName"]
  const safeOrderBy = allowedOrderFields.includes(orderBy) ? orderBy : "publishedDate"

  const [total, items] = await Promise.all([
    prisma.procurementProcess.count({ where }),
    prisma.procurementProcess.findMany({
      where,
      orderBy: { [safeOrderBy]: orderDir },
      skip,
      take: limit,
      select: {
        id: true,
        ocid: true,
        title: true,
        buyerName: true,
        buyerProvince: true,
        status: true,
        procurementMethod: true,
        ocpMethodType: true,
        amountEstimated: true,
        tenderEndDate: true,
        publishedDate: true,
        cpcCodes: true,
        // Include tracking status for this org
        tracking: {
          where: { orgId },
          select: { internalStatus: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      amountEstimated: item.amountEstimated ? Number(item.amountEstimated) : null,
      isTracked: item.tracking.length > 0,
      trackingStatus: item.tracking[0]?.internalStatus ?? null,
      tracking: undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
