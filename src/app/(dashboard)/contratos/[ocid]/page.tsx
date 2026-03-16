import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
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

type Props = { params: Promise<{ ocid: string }> }

export async function generateMetadata({ params }: Props) {
  const { ocid } = await params
  const process = await prisma.procurementProcess.findUnique({
    where: { ocid },
    select: { title: true },
  })
  return { title: process?.title ?? "Contrato" }
}

export default async function ContratoDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { ocid } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

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

  if (!process) notFound()

  const tracking = process.tracking[0] ?? null

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

  const sb = statusConfig[process.status] ?? { label: "Planificación", className: "bg-gray-100 text-gray-700" }
  const ob = ocpConfig[process.ocpMethodType] ?? { label: "OPEN", className: "bg-green-100 text-green-700" }
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
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ob.className}`}>{ob.label}</span>
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
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Entidad contratante</p>
              <p className="text-sm font-medium mt-0.5">{process.buyerName}</p>
              {(process.buyerProvince || process.buyerCanton) && (
                <p className="text-xs text-gray-500">
                  {[process.buyerCanton, process.buyerProvince].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Método de contratación</p>
              <p className="text-sm font-medium mt-0.5">
                {methodLabels[process.procurementMethod] ?? process.procurementMethod}
              </p>
            </div>
            {process.description && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Objeto del contrato</p>
                  <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{process.description}</p>
                </div>
              </>
            )}
            {process.cpcCodes.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Códigos CPC</p>
                  <div className="flex flex-wrap gap-1.5">
                    {process.cpcCodes.map((code) => (
                      <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
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
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Monto estimado</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(process.amountEstimated ? Number(process.amountEstimated) : null)}
              </p>
              {process.amountAwarded && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Monto adjudicado</p>
                  <p className="text-xl font-semibold text-green-700 mt-0.5">
                    {formatCurrency(Number(process.amountAwarded))}
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
                    <CountdownTimer endDate={process.tenderEndDate.toISOString()} />
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
                <p className="text-xs text-gray-500">RUC</p>
                <p className="text-sm font-medium font-mono">{process.winnerId}</p>
              </div>
            )}
            {process.amountAwarded && (
              <div>
                <p className="text-xs text-gray-500">Monto final</p>
                <p className="text-sm font-semibold text-green-700">
                  {formatCurrency(Number(process.amountAwarded))}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracking section */}
      {tracking && (
        <Card className="border shadow-sm border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-800">Mi seguimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Estado interno</p>
              <p className="text-sm font-medium mt-0.5">{tracking.internalStatus}</p>
            </div>
            {tracking.notes && (
              <div>
                <p className="text-xs text-gray-500">Notas</p>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{tracking.notes}</p>
              </div>
            )}
            {process.documents.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Documentos ({process.documents.length})</p>
                <div className="space-y-1.5">
                  {process.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {doc.fileName}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
