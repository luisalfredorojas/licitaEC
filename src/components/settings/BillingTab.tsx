"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react"

interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  date: string
  pdfUrl: string | null
}

interface BillingData {
  plan: string
  subscriptionStatus: string | null
  invoices: Invoice[]
}

const PLAN_FEATURES: Record<string, string[]> = {
  BASIC: ["Alertas por email", "Hasta 5 códigos CPC", "1 usuario"],
  PROFESSIONAL: ["Alertas tiempo real", "CPC ilimitados", "Dashboard analítico", "3 usuarios", "Pipeline + documentos"],
  ENTERPRISE: ["Todo lo del Profesional", "API propia", "Usuarios ilimitados", "Soporte prioritario"],
}

const PLAN_PRICES: Record<string, string> = {
  BASIC: "$29/mes",
  PROFESSIONAL: "$79/mes",
  ENTERPRISE: "$199/mes",
}

export function BillingTab() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentPlan = ((session?.user as any)?.plan ?? "BASIC") as string

  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)

  const { data, isLoading } = useQuery<BillingData>({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/billing/portal")
      return res.json()
    },
  })

  async function openPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const d = await res.json()
      if (d.url) window.location.href = d.url
    } finally {
      setLoadingPortal(false)
    }
  }

  async function startCheckout(plan: "PROFESSIONAL" | "ENTERPRISE") {
    setLoadingCheckout(plan)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const d = await res.json()
      if (d.url) window.location.href = d.url
      else if (d.upgraded) window.location.reload()
    } finally {
      setLoadingCheckout(null)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Plan y Facturación</h2>

      {/* Plan comparison */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(["BASIC", "PROFESSIONAL", "ENTERPRISE"] as const).map((plan) => {
          const isCurrent = plan === currentPlan
          const isUpgrade = ["BASIC", "PROFESSIONAL", "ENTERPRISE"].indexOf(plan) >
            ["BASIC", "PROFESSIONAL", "ENTERPRISE"].indexOf(currentPlan)

          return (
            <div
              key={plan}
              className={`border rounded-lg p-4 ${isCurrent ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">{plan.charAt(0) + plan.slice(1).toLowerCase()}</span>
                {isCurrent && <Badge className="text-xs bg-blue-600">Actual</Badge>}
              </div>
              <p className="text-lg font-bold text-gray-900 mb-3">{PLAN_PRICES[plan]}</p>
              <ul className="space-y-1.5 mb-4">
                {(PLAN_FEATURES[plan] ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isUpgrade && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => startCheckout(plan as "PROFESSIONAL" | "ENTERPRISE")}
                  disabled={loadingCheckout === plan}
                >
                  {loadingCheckout === plan && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Actualizar
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Current subscription status */}
      {data?.subscriptionStatus && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Estado de suscripción</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{data.subscriptionStatus}</p>
          </div>
          <Button variant="outline" size="sm" onClick={openPortal} disabled={loadingPortal}>
            {loadingPortal && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Gestionar suscripción
          </Button>
        </div>
      )}

      {/* Invoice history */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : (data?.invoices ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Historial de facturas</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Monto</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {new Date(inv.date).toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={inv.status === "paid" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {inv.status === "paid" ? "Pagada" : inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
