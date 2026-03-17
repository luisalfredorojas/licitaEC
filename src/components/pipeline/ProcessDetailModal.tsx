"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { TrackingItem } from "./ProcessCard"
import { DocumentList } from "./DocumentList"
import { Loader2, ExternalLink } from "lucide-react"

const schema = z.object({
  notes: z.string().optional(),
  bidAmount: z.string().optional(),
  assignedToId: z.string().optional(),
  decisionDate: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface OrgUser {
  id: string
  name: string | null
  email: string
}

interface Props {
  item: TrackingItem | null
  orgUsers: OrgUser[]
  open: boolean
  onClose: () => void
  onSave: (id: string, data: Partial<TrackingItem>) => Promise<void>
}

export function ProcessDetailModal({ item, orgUsers, open, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (item) {
      reset({
        notes: item.notes ?? "",
        bidAmount: item.bidAmount ? String(item.bidAmount) : "",
        assignedToId: item.assignedToId ?? "",
        decisionDate: item.decisionDate ? item.decisionDate.slice(0, 10) : "",
      })
    }
  }, [item, reset])

  async function onSubmit(values: FormValues) {
    if (!item) return
    setSaving(true)
    try {
      await onSave(item.id, {
        notes: values.notes || null,
        bidAmount: values.bidAmount ? Number(values.bidAmount) : null,
        assignedToId: values.assignedToId || null,
        decisionDate: values.decisionDate ? new Date(values.decisionDate).toISOString() : null,
      } as Partial<TrackingItem>)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold line-clamp-2 pr-4">
            {item.process.title}
          </DialogTitle>
          <p className="text-sm text-gray-500">{item.process.buyerName}</p>
        </DialogHeader>

        {/* Contract summary */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 text-sm">
          {item.process.amountEstimated && (
            <div>
              <span className="text-gray-500">Monto estimado</span>
              <p className="font-medium">{formatCurrency(item.process.amountEstimated)}</p>
            </div>
          )}
          {item.process.tenderEndDate && (
            <div>
              <span className="text-gray-500">Fecha límite</span>
              <p className="font-medium">{formatDate(new Date(item.process.tenderEndDate))}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500">Estado</span>
            <p className="font-medium capitalize">{item.process.status.toLowerCase()}</p>
          </div>
          <div>
            <span className="text-gray-500">Método</span>
            <p className="font-medium text-xs">{item.process.procurementMethod.replace(/_/g, " ")}</p>
          </div>
        </div>

        <a
          href={`/contratos/${item.process.ocid}`}
          target="_blank"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          Ver detalle completo <ExternalLink className="h-3 w-3" />
        </a>

        {/* Editable fields */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bidAmount">Monto de oferta (USD)</Label>
              <Input
                id="bidAmount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("bidAmount")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="decisionDate">Fecha límite interna</Label>
              <Input id="decisionDate" type="date" {...register("decisionDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Asignar responsable</Label>
            <Select
              defaultValue={item.assignedToId ?? ""}
              onValueChange={(val) => setValue("assignedToId", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin asignar</SelectItem>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas del equipo</Label>
            <Textarea
              id="notes"
              rows={4}
              placeholder="Estrategia, observaciones, contactos..."
              {...register("notes")}
            />
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <Label>Documentos</Label>
            <DocumentList trackingId={item.id} processId={item.process.id} ocid={item.process.ocid} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
