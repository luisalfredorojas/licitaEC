import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const SERCOP_BASE = "https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api"

type SercopItem = {
  id: number
  ocid: string
  year: number
  month: number
  method: string
  internal_type: string
  locality: string
  region: string
  suppliers: string
  buyer: string
  amount: string
  date: string
  title: string
  description: string
  budget: string
}

type SercopResponse = {
  total: number
  page: number
  pages: number
  data: SercopItem[]
}

function mapProcurementMethod(internalType: string): string {
  const t = internalType.toLowerCase()
  if (t.includes("subasta inversa")) return "SUBASTA_INVERSA"
  if (t.includes("licitac")) return "LICITACION"
  if (t.includes("cotizac")) return "COTIZACION"
  if (t.includes("cat\u00e1logo") || t.includes("catalogo")) return "CATALOGO_ELECTRONICO"
  if (t.includes("menor cuant")) return "MENOR_CUANTIA"
  if (t.includes("consultor")) return "CONSULTORIA_LISTA_CORTA"
  if (t.includes("\u00edn\u00edma") || t.includes("infima")) return "INFIMA_CUANTIA"
  return "MENOR_CUANTIA"
}

function mapOcpType(method: string): string {
  switch (method.toLowerCase()) {
    case "open": return "OPEN"
    case "selective": return "SELECTIVE"
    case "limited": return "LIMITED"
    case "direct": return "DIRECT"
    default: return "OPEN"
  }
}

function mapStatus(item: SercopItem): string {
  // Processes with a future date or active tenders
  const itemDate = new Date(item.date)
  const now = new Date()
  if (itemDate > now) return "TENDER"
  // Catalogue / direct purchases are completed contracts
  const t = item.internal_type.toLowerCase()
  if (t.includes("cat\u00e1logo") || t.includes("catalogo") || item.method === "direct") {
    return "CONTRACT"
  }
  return "AWARD"
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl

  const q = searchParams.get("q") ?? ""
  const methodParam = searchParams.getAll("method[]")
  const provinceParam = searchParams.getAll("province[]")
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const year = searchParams.get("year") ?? String(new Date().getFullYear())

  // Build SERCOP query
  const sercopParams = new URLSearchParams({ page: String(page), year })
  if (q.trim()) sercopParams.set("search", q.trim())

  let sercopData: SercopResponse
  try {
    const res = await fetch(`${SERCOP_BASE}/search_ocds?${sercopParams.toString()}`, {
      signal: AbortSignal.timeout(20_000),
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`SERCOP responded with ${res.status}`)
    sercopData = await res.json()
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json(
      { error: `No se pudo conectar con SERCOP: ${message}` },
      { status: 502 }
    )
  }

  // Map to UI format
  let items = sercopData.data.map((item) => ({
    id: String(item.id),
    ocid: item.ocid,
    title: item.title,
    description: item.description ?? null,
    buyerName: item.buyer,
    buyerProvince: item.region ?? null,
    status: mapStatus(item),
    procurementMethod: mapProcurementMethod(item.internal_type),
    ocpMethodType: mapOcpType(item.method),
    amountEstimated: item.amount ? parseFloat(item.amount) : null,
    tenderEndDate: null as string | null,
    publishedDate: item.date ?? null,
    cpcCodes: [] as string[],
    isTracked: false,
    trackingStatus: null as string | null,
  }))

  // Post-response filtering (SERCOP API doesn't support these natively)
  if (methodParam.length > 0) {
    items = items.filter((item) => methodParam.includes(item.procurementMethod))
  }
  if (provinceParam.length > 0) {
    items = items.filter((item) =>
      item.buyerProvince !== null &&
      provinceParam.some((p) =>
        item.buyerProvince!.toLowerCase().includes(p.toLowerCase())
      )
    )
  }

  return NextResponse.json({
    items,
    pagination: {
      page: sercopData.page,
      limit: 25,
      total: sercopData.total,
      totalPages: sercopData.pages,
    },
  })
}
