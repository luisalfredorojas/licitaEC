"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { ProcessCard } from "@/components/pipeline/ProcessCard"
import type { TrackingItem } from "@/components/pipeline/ProcessCard"
import { ProcessDetailModal } from "@/components/pipeline/ProcessDetailModal"
import { formatCurrency } from "@/lib/utils"
import { AlertCircle, Loader2 } from "lucide-react"

type TrackingStatus = "INTERESTED" | "PREPARING" | "SUBMITTED" | "WON" | "LOST" | "DISCARDED"

interface PipelineData {
  columns: Record<string, TrackingItem[]>
  summary: {
    totalInPlay: number
    countPerColumn: Record<string, number>
    venceEstaSemana: Array<{ id: string; title: string; ocid: string; tenderEndDate: string }>
  }
}

const COLUMNS: { status: TrackingStatus; label: string; color: string }[] = [
  { status: "INTERESTED", label: "👀 Interesado", color: "border-blue-300" },
  { status: "PREPARING", label: "📝 Preparando oferta", color: "border-amber-300" },
  { status: "SUBMITTED", label: "📤 Oferta enviada", color: "border-purple-300" },
  { status: "WON", label: "🏆 Ganado", color: "border-green-400" },
  { status: "LOST", label: "❌ Perdido / Descartado", color: "border-gray-300" },
]

function KanbanColumn({
  status,
  label,
  color,
  items,
  onCardClick,
}: {
  status: TrackingStatus
  label: string
  color: string
  items: TrackingItem[]
  onCardClick: (item: TrackingItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      className={`flex flex-col min-w-[260px] w-[260px] bg-gray-50 rounded-xl border-t-4 ${color} transition-colors ${isOver ? "bg-blue-50" : ""}`}
    >
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-xs bg-white border rounded-full px-2 py-0.5 text-gray-500 font-medium">
          {items.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 px-2 pb-2 space-y-2 min-h-[80px]">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <ProcessCard key={item.id} item={item} onClick={() => onCardClick(item)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<TrackingItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const { data, isLoading, error } = useQuery<PipelineData>({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline")
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Error cargando pipeline")
      }
      return res.json()
    },
  })

  const { data: orgUsersData } = useQuery<{ users: Array<{ id: string; name: string | null; email: string }> }>({
    queryKey: ["org-users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      return res.json()
    },
  })

  const patchMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const res = await fetch(`/api/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Error actualizando")
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  })

  const findItem = useCallback(
    (id: string): TrackingItem | null => {
      if (!data) return null
      for (const items of Object.values(data.columns)) {
        const found = items.find((i) => i.id === id)
        if (found) return found
      }
      return null
    },
    [data]
  )

  function findColumn(id: string): TrackingStatus | null {
    if (!data) return null
    for (const [status, items] of Object.entries(data.columns)) {
      if (items.find((i) => i.id === id)) return status as TrackingStatus
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeColumn = findColumn(active.id as string)
    const overColumn = (COLUMNS.find((c) => c.status === over.id)?.status ??
      findColumn(over.id as string)) as TrackingStatus | null

    if (!activeColumn || !overColumn || activeColumn === overColumn) return

    // Optimistic update
    queryClient.setQueryData<PipelineData>(["pipeline"], (old) => {
      if (!old) return old
      const item = old.columns[activeColumn]?.find((i) => i.id === active.id)
      if (!item) return old
      return {
        ...old,
        columns: {
          ...old.columns,
          [activeColumn]: (old.columns[activeColumn] ?? []).filter((i) => i.id !== active.id),
          [overColumn]: [...(old.columns[overColumn] ?? []), { ...item, internalStatus: overColumn }],
        },
      }
    })

    patchMutation.mutate({ id: active.id as string, updates: { internalStatus: overColumn } })
  }

  async function handleSave(id: string, updates: Partial<TrackingItem>) {
    await patchMutation.mutateAsync({ id, updates: updates as Record<string, unknown> })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    const errMsg = (error as Error).message
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <p className="text-gray-600 max-w-md">{errMsg}</p>
        {errMsg.toLowerCase().includes("plan") && (
          <a href="/configuracion?tab=billing" className="text-sm text-blue-600 hover:underline">
            Actualizar plan →
          </a>
        )}
      </div>
    )
  }

  const columns = data?.columns ?? {}
  const summary = data?.summary

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona tus procesos de licitación</p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 pb-4">
            {COLUMNS.map(({ status, label, color }) => (
              <KanbanColumn
                key={status}
                status={status}
                label={label}
                color={color}
                items={columns[status] ?? []}
                onCardClick={(item) => {
                  setSelectedItem(item)
                  setModalOpen(true)
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId && findItem(activeId) ? (
              <div className="opacity-90 rotate-1 shadow-lg">
                <ProcessCard item={findItem(activeId)!} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Right sidebar summary */}
      <aside className="w-64 border-l bg-white p-4 overflow-y-auto flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Resumen</h2>

        {summary && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">Monto total en juego</p>
              <p className="text-lg font-bold text-blue-800 mt-0.5">
                {formatCurrency(summary.totalInPlay)}
              </p>
              <p className="text-xs text-blue-500 mt-0.5">Interesado + Preparando + Enviado</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Procesos por columna</p>
              <div className="space-y-1.5">
                {COLUMNS.map(({ status, label }) => (
                  <div key={status} className="flex justify-between text-xs">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-800">
                      {summary.countPerColumn[status] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {summary.venceEstaSemana.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-2">
                  ⏰ Vence esta semana ({summary.venceEstaSemana.length})
                </p>
                <div className="space-y-1.5">
                  {summary.venceEstaSemana.map((item) => (
                    <a
                      key={item.id}
                      href={`/contratos/${item.ocid}`}
                      className="block text-xs text-gray-700 hover:text-blue-600 leading-snug"
                    >
                      {item.title.length > 60 ? `${item.title.slice(0, 60)}…` : item.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      <ProcessDetailModal
        item={selectedItem}
        orgUsers={orgUsersData?.users ?? []}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
