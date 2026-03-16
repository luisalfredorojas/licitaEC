"use client"

import { cn } from "@/lib/utils"
import { ClipboardList, FileText, Search, Award, FileSignature } from "lucide-react"

const STAGES = [
  { key: "PLANNING", label: "Planificación", icon: ClipboardList },
  { key: "TENDER", label: "Licitación", icon: FileText },
  { key: "AWARD", label: "Adjudicación", icon: Award },
  { key: "CONTRACT", label: "Contrato", icon: FileSignature },
] as const

const stageOrder = ["PLANNING", "TENDER", "AWARD", "CONTRACT", "CANCELLED"]

type Props = { status: string }

export function ProcessTimeline({ status }: Props) {
  const currentIndex = stageOrder.indexOf(status)
  const isCancelled = status === "CANCELLED"

  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Ciclo de vida del proceso
      </p>
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const stageIdx = stageOrder.indexOf(stage.key)
          const isPast = !isCancelled && stageIdx < currentIndex
          const isCurrent = !isCancelled && stage.key === status
          const isFuture = isCancelled || stageIdx > currentIndex
          const isLast = i === STAGES.length - 1

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isCurrent && "bg-blue-600 text-white ring-4 ring-blue-100",
                    isPast && "bg-green-500 text-white",
                    isFuture && !isCancelled && "bg-gray-100 text-gray-400",
                    isCancelled && stage.key === "PLANNING" && "bg-red-100 text-red-500"
                  )}
                >
                  <stage.icon className="h-4 w-4" />
                </div>
                <p
                  className={cn(
                    "text-xs mt-1.5 font-medium text-center truncate w-full",
                    isCurrent && "text-blue-700",
                    isPast && "text-green-700",
                    isFuture && "text-gray-400"
                  )}
                >
                  {stage.label}
                </p>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 mb-5",
                    isPast || (isCurrent && i < 3) ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
        {isCancelled && (
          <div className="flex flex-col items-center shrink-0 ml-2">
            <div className="w-9 h-9 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
              <Search className="h-4 w-4" />
            </div>
            <p className="text-xs mt-1.5 font-medium text-red-500">Cancelado</p>
          </div>
        )}
      </div>
    </div>
  )
}
