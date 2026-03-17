"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { formatCurrency } from "@/lib/utils"
import { differenceInDays } from "date-fns"
import { GripVertical } from "lucide-react"

export interface TrackingItem {
  id: string
  internalStatus: string
  notes: string | null
  bidAmount: number | null
  assignedToId: string | null
  decisionDate: string | null
  process: {
    id: string
    ocid: string
    title: string
    buyerName: string
    amountEstimated: number | null
    tenderEndDate: string | null
    status: string
    procurementMethod: string
  }
  assignedTo: { id: string; name: string | null; email: string } | null
}

interface Props {
  item: TrackingItem
  onClick: () => void
}

export function ProcessCard({ item, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const daysLeft = item.process.tenderEndDate
    ? differenceInDays(new Date(item.process.tenderEndDate), new Date())
    : null

  const displayAmount = item.bidAmount ?? item.process.amountEstimated

  const initials = (name: string | null) => {
    if (!name) return "?"
    return name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
            {item.process.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.process.buyerName}</p>

          <div className="flex items-center justify-between mt-2">
            {displayAmount ? (
              <span className="text-xs font-semibold text-gray-700">
                {formatCurrency(displayAmount)}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Sin monto</span>
            )}

            <div className="flex items-center gap-1.5">
              {daysLeft !== null && (
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    daysLeft < 0
                      ? "bg-gray-100 text-gray-500"
                      : daysLeft <= 3
                      ? "bg-red-100 text-red-700"
                      : daysLeft <= 7
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {daysLeft < 0 ? "Vencido" : `${daysLeft}d`}
                </span>
              )}

              {item.assignedTo && (
                <div
                  className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium flex-shrink-0"
                  title={item.assignedTo.name ?? item.assignedTo.email}
                >
                  {initials(item.assignedTo.name ?? item.assignedTo.email)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
