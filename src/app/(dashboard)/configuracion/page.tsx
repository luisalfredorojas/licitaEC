"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmpresaTab } from "@/components/settings/EmpresaTab"
import { UsuariosTab } from "@/components/settings/UsuariosTab"
import { CpcTab } from "@/components/settings/CpcTab"
import { NotificacionesTab } from "@/components/settings/NotificacionesTab"
import { BillingTab } from "@/components/settings/BillingTab"

const TABS = [
  { value: "empresa", label: "Empresa" },
  { value: "usuarios", label: "Usuarios" },
  { value: "cpc", label: "Códigos CPC" },
  { value: "notificaciones", label: "Notificaciones" },
  { value: "billing", label: "Plan y Facturación" },
]

function ConfiguracionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get("tab") ?? "empresa"

  function handleTabChange(value: string) {
    router.push(`/configuracion?tab=${value}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList className="mb-6 h-auto gap-1">
        {TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} className="text-sm">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="empresa">
        <EmpresaTab />
      </TabsContent>
      <TabsContent value="usuarios">
        <UsuariosTab />
      </TabsContent>
      <TabsContent value="cpc">
        <CpcTab />
      </TabsContent>
      <TabsContent value="notificaciones">
        <NotificacionesTab />
      </TabsContent>
      <TabsContent value="billing">
        <BillingTab />
      </TabsContent>
    </Tabs>
  )
}

export default function ConfiguracionPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona tu organización, usuarios y preferencias</p>
      </div>
      <Suspense fallback={<div className="h-8" />}>
        <ConfiguracionContent />
      </Suspense>
    </div>
  )
}
