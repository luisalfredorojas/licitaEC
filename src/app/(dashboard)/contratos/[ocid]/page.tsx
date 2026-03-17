import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ExternalLink, Copy, ArrowLeft } from "lucide-react"
import { ContratoActions } from "@/components/contratos/ContratoActions"
import { ProcessTimeline } from "@/components/contratos/ProcessTimeline"
import { CountdownTimer } from "@/components/contratos/CountdownTimer"
import { AwardItemsTable } from "@/components/contratos/AwardItemsTable"
import type { ContratoDetail } from "@/app/api/contratos/[ocid]/route"

type Props = { params: Promise<{ ocid: string }> }

const SERCOP_RECORD_URL =
  "https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/record"

// ── OCDS local types (used only for parsing the raw SERCOP response) ──────────

type RawParty = { id: string; name: string }
type RawValue = { amount: number; currency: string }
type RawClassification = { id: string; scheme: string; description?: string }

type RawItem = {
  id: string
  description: string
  quantity?: number
  unit?: { value?: RawValue }
  classification?: RawClassification
  additionalClassifications?: RawClassification[]
}

type RawAward = {
  id: string
  value?: RawValue
  status?: string
  date?: string
  suppliers?: RawParty[]
  items?: RawItem[]
}

type RawRelease = {
  id: string
  ocid: string
  date?: string
  tag?: string[]
  buyer?: RawParty
  tender?: {
    id?: string
    title?: string
    description?: string
    value?: RawValue
    status?: string
    procurementMethod?: string
    procurementMethodDetails?: string
    tenderPeriod?: { startDate?: string; endDate?: string }
    procuringEntity?: RawParty
  }
  awards?: RawAward[]
}

type RawOcdsRecord = { releases?: RawRelease[] }

// ── Mapping helpers ───────────────────────────────────────────────────────────

function extractRuc(partyId: string | undefined): string | null {
  if (!partyId) return null
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

function mapOcpMethodType(method: string | undefined): string {
  switch ((method ?? "").toLowerCase()) {
    case "open": return "OPEN"
    case "selective": return "SELECTIVE"
    case "limited": return "LIMITED"
    case "direct": return "DIRECT"
    default: return "OPEN"
  }
}

function mapStatus(
  tenderStatus: string | undefined,
  releaseTags: string[]
): ContratoDetail["status"] {
  const s = (tenderStatus ?? "").toLowerCase()
  if (s === "complete" || s === "closed") {
    if (releaseTags.includes("contract")) return "CONTRACT"
    if (releaseTags.includes("award")) return "AWARD"
    return "CONTRACT"
  }
  if (s === "active" || s === "open") return "TENDER"
  if (s === "cancelled" || s === "withdrawn") return "CANCELLED"
  if (releaseTags.includes("contract")) return "CONTRACT"
  if (releaseTags.includes("award")) return "AWARD"
  if (releaseTags.includes("tender")) return "TENDER"
  return "TENDER"
}

function mapReleasesToDetail(ocid: string, releases: RawRelease[]): ContratoDetail {
  // Caller guarantees at least one release — cast to avoid undefined index error
  const primary = releases[releases.length - 1] as RawRelease
  const tender = primary.tender
  const buyer = primary.buyer

  const allAwards = releases.flatMap((r) => r.awards ?? [])
  const activeAward =
    allAwards.find((a) => a.status === "active") ?? allAwards[0] ?? null

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

  const mappedItems: ContratoDetail["items"] = (activeAward?.items ?? []).map((item) => {
    const unitPrice = item.unit?.value?.amount ?? null
    const quantity = item.quantity ?? null
    const totalPrice =
      unitPrice !== null && quantity !== null ? unitPrice * quantity : null
    const cpcClass =
      item.classification?.scheme === "CPC"
        ? item.classification
        : (item.additionalClassifications?.find((ac) => ac.scheme === "CPC") ?? null)
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

  const publishedDate =
    releases
      .map((r) => r.date)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null

  const awardDate =
    activeAward?.date ??
    releases.find((r) => r.tag?.includes("award"))?.date ??
    null

  const tags = releases.flatMap((r) => r.tag ?? [])
  const supplier = activeAward?.suppliers?.[0] ?? null

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
    buyerProvince: null,
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

async function fetchContrato(ocid: string): Promise<ContratoDetail | null> {
  try {
    const res = await fetch(
      `${SERCOP_RECORD_URL}?ocid=${encodeURIComponent(ocid)}`,
      {
        signal: AbortSignal.timeout(20_000),
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return null
    const record = (await res.json()) as RawOcdsRecord
    const releases = record.releases ?? []
    if (releases.length === 0) return null
    return mapReleasesToDetail(ocid, releases)
  } catch {
    return null
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props) {
  const { ocid } = await params
  const process = await fetchContrato(ocid)
  return { title: process?.title ?? "Contrato" }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ContratoDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { ocid } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const process = await fetchContrato(ocid)
  if (!process) notFound()

  // Tracking is always null — local DB tracking will be re-enabled in a future phase
  const tracking = null

  const statusConfig: Record<string, { label: string; className: string }> = {
    PLANNING: { label: "Planificación", className: "bg-gray-100 text-gray-700" },
    TENDER: { label: "Licitación activa", className: "bg-yellow-100 text-yellow-800" },
    AWARD: { label: "Adjudicado", className: "bg-green-100 text-green-800" },
    CONTRACT: { label: "Contrato firmado", className: "bg-blue-100 text-blue-800" },
    CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-700" },
  }

  const ocpConfig: Record<string, { label: string; className: string }> = {
    OPEN: { label: "OPEN", className: "bg-green-100 text-green-700" },
    SELECTIVE: { label: "SELECTIVE", className: "bg-blue-100 text-blue-700" },
    LIMITED: { label: "LIMITED", className: "bg-purple-100 text-purple-700" },
    DIRECT: { label: "DIRECT", className: "bg-gray-100 text-gray-600" },
  }

  const methodLabels: Record<string, string> = {
    SUBASTA_INVERSA: "Subasta Inversa Electrónica",
    LICITACION: "Licitación",
    COTIZACION: "Cotización",
    MENOR_CUANTIA: "Menor Cuantía",
    INFIMA_CUANTIA: "Ínfima Cuantía",
    CONSULTORIA_LISTA_CORTA: "Consultoría – Lista Corta",
    CATALOGO_ELECTRONICO: "Catálogo Electrónico",
    OTHER: "Otro",
  }

  const sb =
    statusConfig[process.status] ?? { label: "Planificación", className: "bg-gray-100 text-gray-700" }
  const ob =
    ocpConfig[process.ocpMethodType] ?? { label: "OPEN", className: "bg-green-100 text-green-700" }
  const sercop_url = `https://www.compraspublicas.gob.ec/ProcesoContratacion/compras/PC/proceso.cpe?idProceso=${ocid}`

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/contratos">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Contratos
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ob.className}`}>
            {ob.label}
          </span>
          <Badge className={sb.className + " border-0"}>{sb.label}</Badge>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{process.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ContratoActions ocid={ocid} orgId={orgId} initialTracking={tracking} />
          <Button variant="outline" size="sm" asChild>
            <a href={sercop_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver en SERCOP
            </a>
          </Button>
        </div>
      </div>

      {/* TIMELINE */}
      <ProcessTimeline status={process.status} />

      {/* Main info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Información general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Entidad contratante
              </p>
              <p className="text-sm font-medium mt-0.5">{process.buyerName}</p>
              {process.buyerProvince && (
                <p className="text-xs text-gray-500">{process.buyerProvince}</p>
              )}
              {process.buyerRuc && (
                <p className="text-xs text-gray-400 font-mono mt-1">
                  RUC: {process.buyerRuc}
                </p>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Método de contratación
              </p>
              <p className="text-sm font-medium mt-0.5">
                {methodLabels[process.procurementMethod] ?? process.procurementMethod}
              </p>
            </div>
            {process.description && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    Objeto del contrato
                  </p>
                  <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                    {process.description}
                  </p>
                </div>
              </>
            )}
            {process.cpcCodes.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    Códigos CPC
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {process.cpcCodes.map((code) => (
                      <Badge key={code} variant="outline" className="text-xs">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">OCID</p>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{ocid}</code>
                <button
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copiar OCID"
                  onClick={undefined}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right */}
        <div className="space-y-4">
          {/* Amount card */}
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Monto estimado
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(process.amountEstimated)}
              </p>
              {process.amountAwarded && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    Monto adjudicado
                  </p>
                  <p className="text-xl font-semibold text-green-700 mt-0.5">
                    {formatCurrency(process.amountAwarded)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dates card */}
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-3">
              {process.publishedDate && (
                <div>
                  <p className="text-xs text-gray-500">Publicación</p>
                  <p className="text-sm font-medium">{formatDate(process.publishedDate)}</p>
                </div>
              )}
              {process.tenderEndDate && (
                <div>
                  <p className="text-xs text-gray-500">Fecha límite de presentación</p>
                  <p className="text-sm font-medium">{formatDate(process.tenderEndDate)}</p>
                  {process.status === "TENDER" && (
                    <CountdownTimer endDate={process.tenderEndDate} />
                  )}
                </div>
              )}
              {process.awardDate && (
                <div>
                  <p className="text-xs text-gray-500">Adjudicación</p>
                  <p className="text-sm font-medium">{formatDate(process.awardDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Winner */}
      {(process.winnerName || process.winnerId) && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proveedor adjudicado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {process.winnerName && (
              <div>
                <p className="text-xs text-gray-500">Nombre</p>
                <p className="text-sm font-medium">{process.winnerName}</p>
              </div>
            )}
            {process.winnerId && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  RUC proveedor
                </p>
                <code className="mt-1 inline-block text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-800 tracking-wide">
                  {process.winnerId}
                </code>
              </div>
            )}
            {process.amountAwarded && (
              <div>
                <p className="text-xs text-gray-500">Monto final</p>
                <p className="text-sm font-semibold text-green-700">
                  {formatCurrency(process.amountAwarded)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items adjudicados */}
      {process.items.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Items adjudicados
              <span className="ml-2 text-xs font-normal text-gray-400">
                {process.items.length} {process.items.length === 1 ? "item" : "items"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <AwardItemsTable items={process.items} />
          </CardContent>
        </Card>
      )}

      {/* Tracking section — re-enabled when local DB pipeline is connected */}
    </div>
  )
}
