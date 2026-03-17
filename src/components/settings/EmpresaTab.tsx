"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle } from "lucide-react"
import { useState } from "react"

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(120),
  rupCode: z.string().max(20).optional(),
})
type FormValues = z.infer<typeof schema>

interface OrgData {
  id: string
  name: string
  ruc: string
  rupCode: string | null
  plan: string
}

export function EmpresaTab() {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: org, isLoading } = useQuery<OrgData>({
    queryKey: ["org"],
    queryFn: async () => {
      const res = await fetch("/api/organization")
      return res.json()
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (org) reset({ name: org.name, rupCode: org.rupCode ?? "" })
  }, [org, reset])

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Error guardando")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) return <div className="h-40 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Información de la empresa</h2>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Nombre de la organización</Label>
          <Input {...register("name")} />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>RUC</Label>
          <Input value={org?.ruc ?? ""} disabled className="bg-gray-50" />
          <p className="text-xs text-gray-400">El RUC no puede modificarse.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Código RUP (opcional)</Label>
          <Input {...register("rupCode")} placeholder="Registro Único de Proveedores SERCOP" />
          <p className="text-xs text-gray-400">Código de habilitación para licitar en SERCOP.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Guardado
            </span>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-500">Error al guardar. Inténtalo de nuevo.</p>
        )}
      </form>
    </div>
  )
}
