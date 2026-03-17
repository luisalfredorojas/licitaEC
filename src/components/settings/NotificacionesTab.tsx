"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle } from "lucide-react"
import { PushNotificationButton } from "@/components/settings/PushNotificationButton"

interface ChannelPrefs {
  email: boolean
  push: boolean
}
interface NotifPrefs {
  newProcess?: ChannelPrefs
  statusChange?: ChannelPrefs
  deadlineReminder?: ChannelPrefs
  frequency?: "immediate" | "daily" | "weekly"
}

const DEFAULT: Required<NotifPrefs> = {
  newProcess: { email: true, push: false },
  statusChange: { email: true, push: false },
  deadlineReminder: { email: true, push: false },
  frequency: "immediate",
}

type ChannelKey = "newProcess" | "statusChange" | "deadlineReminder"

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  newProcess: "Nuevo contrato que coincide con mis CPC",
  statusChange: "Contrato cambia de estado",
  deadlineReminder: "Fecha límite se acerca (3 días)",
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

export function NotificacionesTab() {
  const queryClient = useQueryClient()
  const [prefs, setPrefs] = useState<Required<NotifPrefs>>(DEFAULT)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery<{ preferences: NotifPrefs }>({
    queryKey: ["notif-prefs"],
    queryFn: async () => {
      const res = await fetch("/api/organization/notifications")
      return res.json()
    },
  })

  useEffect(() => {
    if (data?.preferences) {
      setPrefs({ ...DEFAULT, ...data.preferences })
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: async (values: NotifPrefs) => {
      const res = await fetch("/api/organization/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error("Error guardando")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notif-prefs"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function updateChannel(key: ChannelKey, channel: "email" | "push", value: boolean) {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: value } }))
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Notificaciones</h2>

      <div className="border rounded-lg overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_80px_80px] bg-gray-50 border-b">
          <div className="px-4 py-2.5 text-xs font-medium text-gray-500">Evento</div>
          <div className="px-2 py-2.5 text-xs font-medium text-gray-500 text-center">Email</div>
          <div className="px-2 py-2.5 text-xs font-medium text-gray-500 text-center">Push</div>
        </div>
        {(Object.entries(CHANNEL_LABELS) as [ChannelKey, string][]).map(([key, label]) => (
          <div key={key} className="grid grid-cols-[1fr_80px_80px] border-b last:border-0 hover:bg-gray-50">
            <div className="px-4 py-3 text-sm text-gray-700">{label}</div>
            <div className="flex items-center justify-center px-2 py-3">
              <Toggle
                checked={prefs[key]?.email ?? true}
                onChange={(v) => updateChannel(key, "email", v)}
              />
            </div>
            <div className="flex items-center justify-center px-2 py-3">
              <Toggle
                checked={prefs[key]?.push ?? false}
                onChange={(v) => updateChannel(key, "push", v)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 mb-4">
        <Label>Frecuencia de resumen por email</Label>
        <Select
          value={prefs.frequency}
          onValueChange={(v) => setPrefs((p) => ({ ...p, frequency: v as "immediate" | "daily" | "weekly" }))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">Inmediata</SelectItem>
            <SelectItem value="daily">Resumen diario</SelectItem>
            <SelectItem value="weekly">Resumen semanal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Push notification setup */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Notificaciones en el navegador</p>
        <p className="text-xs text-gray-500 mb-3">
          Recibe alertas instantáneas en tu navegador, incluso cuando no tienes LicitaEC abierto.
        </p>
        <PushNotificationButton />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => mutation.mutate(prefs)} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar preferencias
        </Button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Guardado
          </span>
        )}
      </div>
    </div>
  )
}
