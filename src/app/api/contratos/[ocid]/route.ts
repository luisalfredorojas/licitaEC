import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const SERCOP_BASE = "https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api"

// ── OCDS raw types ────────────────────────────────────────────────────────────

type OcdsMonetaryValue = {
  amount: number
  currency: string
}

type OcdsParty = {
  id: string
  name: string
}

type OcdsClassification = {
  id: string
  scheme: string
  description?: string
}

type OcdsItem = {
  id: string
  description: string
  quantity?: number
  unit?: { value?: OcdsMonetaryValue }
  classification?: OcdsClassification
  additionalClassifications?: OcdsClassification[]
}

type OcdsAward = {
  id: string
  value?: OcdsMonetaryValue
  status?: string
  date?: string
  suppliers?: OcdsParty[]
  items?: OcdsItem[]
}

type OcdsTender = {
  id?: string
  title?: string
  description?: string
  value?: OcdsMonetaryValue
  status?: string
  procurementMethod?: string
  procurementMethodDetails?: string
  tenderPeriod?: { startDate?: string; endDate?: string }
  procuringEntity?: OcdsParty
}

type OcdsRelease = {
  id: string
  ocid: string
  date?: string
  tag?: string[]
  buyer?: OcdsParty
  tender?: OcdsTender
  awards?: OcdsAward[]
}

type OcdsRecord = {
  uri?: string
  version?: string
  releases?: OcdsRelease[]
}

// ── Mapped response type ──────────────────────────────────────────────────────

export type ContratoDetail = {
  ocid: string
  title: string
  description: string | null
  status: "PLANNING" | "TENDER" | "AWARD" | "CONTRACT" | "CANCELLED"
  procurementMethod: string
  ocpMethodType: string
  buyerName: string
  buyerProvince: string | null
  buyerRuc: string | null
  amountEstimated: number | null
  amountAwarded: number | null
  publishedDate: string | null
  tenderEndDate: string | null
  awardDate: string | null
  winnerName: string | null
  winnerId: string | null
  cpcCodes: string[]
  items: Array<{
    id: string
    description: string
    quantity: number | null
    unitPrice: number | null
    totalPrice: number | null
    cpcCode: string | null
    cpcDescription: string | null
  }>
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function extractRuc(partyId: string | undefined): string | null {
  if (!partyId) return null
  // Format: EC-RUC-XXXXXXXXX001 or EC-RUC-XXXXXXXXX001-YYYY
  const match = partyId.match(/EC-RUC-(\d+)/)
  return match?.[1] ?? null
}

function mapProcurementMethod(details: string | undefined): string {
  const t = (details ?? "").toLowerCase()
  if (t.includes("subasta inversa")) return "SUBASTA_INVERSA"
  if (t.includes("licitac")) return "LICITACION"
  if (t.includes("cotizac")) return "COTIZACION"
  if (t.includes("catálogo") || t.includes("catalogo")) return "CATALOGO_ELECTRONICO"
  if (t.includes("menor cuant")) return "MENOR_CUANTIA"
  if (t.includes("consultor")) return "CONSULTORIA_LISTA_CORTA"
  if (t.includes("ínfima") || t.includes("infima")) return "INFIMA_CUANTIA"
  return "OTHER"
}

function mapOcpMethodType(procurementMethod: string | undefined): string {
  switch ((procurementMethod ?? "").toLowerCase()) {
    case "open": return "OPEN"
    case "selective": return "SELECTIVE"
    case "limited": return "LIMITED"
    case "direct": return "DIRECT"
    default: return "OPEN"
  }
}

function mapStatus(
  tenderStatus: string | undefined,
  tags: string[] | undefined
): ContratoDetail["status"] {
  const s = (tenderStatus ?? "").toLowerCase()
  if (s === "complete" || s === "closed") {
    // If there's a contract tag, it's CONTRACT; otherwise AWARD
    if (tags?.includes("contract")) return "CONTRACT"
    if (tags?.includes("award")) return "AWARD"
    return "CONTRACT"
  }
  if (s === "active" || s === "open") return "TENDER"
  if (s === "cancelled" || s === "withdrawn") return "CANCELLED"
  if (tags?.includes("contract")) return "CONTRACT"
  if (tags?.includes("award")) return "AWARD"
  if (tags?.includes("tender")) return "TENDER"
  return "TENDER"
}

function mapReleasesToDetail(ocid: string, releases: OcdsRelease[]): ContratoDetail {
  // Use the most recent release as the primary source — caller guarantees at least one release
  const primary = releases[releases.length - 1] as OcdsRelease

  const tender = primary.tender
  const buyer = primary.buyer

  // Collect all awards across all releases; prefer active ones
  const allAwards = releases.flatMap((r) => r.awards ?? [])
  const activeAward = allAwards.find((a) => a.status === "active") ?? allAwards[0] ?? null

  // CPC codes from award items across all releases
  const cpcCodeSet = new Set<string>()
  for (const release of releases) {
    for (const award of release.awards ?? []) {
      for (const item of award.items ?? []) {
        if (item.classification?.scheme === "CPC" && item.classification.id) {
          cpcCodeSet.add(item.classification.id)
        }
        for (const ac of item.additionalClassifications ?? []) {
          if (ac.scheme === "CPC" && ac.id) {
            cpcCodeSet.add(ac.id)
          }
        }
      }
    }
  }

  // Line items from the active (or first) award
  const mappedItems: ContratoDetail["items"] = (activeAward?.items ?? []).map((item) => {
    const unitPrice = item.unit?.value?.amount ?? null
    const quantity = item.quantity ?? null
    const totalPrice =
      unitPrice !== null && quantity !== null ? unitPrice * quantity : null

    const cpcClass =
      item.classification?.scheme === "CPC"
        ? item.classification
        : item.additionalClassifications?.find((ac) => ac.scheme === "CPC") ?? null

    return {
      id: item.id,
      description: item.description,
      quantity,
      unitPrice,
      totalPrice,
      cpcCode: cpcClass?.id ?? null,
      cpcDescription: cpcClass?.description ?? null,
    }
  })

  // Earliest release date for publishedDate
  const publishedDate =
    releases
      .map((r) => r.date)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null

  // Award date from active award or latest release date with award tag
  const awardDate =
    activeAward?.date ??
    releases.find((r) => r.tag?.includes("award"))?.date ??
    null

  const supplier = activeAward?.suppliers?.[0] ?? null

  const tags = releases.flatMap((r) => r.tag ?? [])

  return {
    ocid,
    title: tender?.title ?? ocid,
    description: tender?.description ?? null,
    status: mapStatus(tender?.status, tags),
    procurementMethod: mapProcurementMethod(
      tender?.procurementMethodDetails ?? tender?.procurementMethod
    ),
    ocpMethodType: mapOcpMethodType(tender?.procurementMethod),
    buyerName: buyer?.name ?? tender?.procuringEntity?.name ?? "—",
    buyerProvince: null, // OCDS record API does not expose province directly
    buyerRuc: extractRuc(buyer?.id ?? tender?.procuringEntity?.id),
    amountEstimated: tender?.value?.amount ?? null,
    amountAwarded: activeAward?.value?.amount ?? null,
    publishedDate,
    tenderEndDate: tender?.tenderPeriod?.endDate ?? null,
    awardDate,
    winnerName: supplier?.name ?? null,
    winnerId: extractRuc(supplier?.id),
    cpcCodes: Array.from(cpcCodeSet),
    items: mappedItems,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ocid: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { ocid } = await params

  let record: OcdsRecord
  try {
    const res = await fetch(
      `${SERCOP_BASE}/record?ocid=${encodeURIComponent(ocid)}`,
      {
        signal: AbortSignal.timeout(20_000),
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) throw new Error(`SERCOP respondió con ${res.status}`)
    record = (await res.json()) as OcdsRecord
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json(
      { error: `No se pudo conectar con SERCOP: ${message}` },
      { status: 502 }
    )
  }

  if (!record.releases || record.releases.length === 0) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
  }

  const detail = mapReleasesToDetail(ocid, record.releases)

  return NextResponse.json(detail)
}
