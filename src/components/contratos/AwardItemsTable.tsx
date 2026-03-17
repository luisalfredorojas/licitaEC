import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

export type AwardItem = {
  id: string
  description: string
  quantity: number | null
  unitPrice: number | null
  totalPrice: number | null
  cpcCode: string | null
  cpcDescription: string | null
}

type Props = {
  items: AwardItem[]
}

export function AwardItemsTable({ items }: Props) {
  if (items.length === 0) return null

  return (
    <>
      {/* Desktop table — hidden on small screens */}
      <div className="hidden sm:block overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">
                Descripcion
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Codigo CPC
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Cantidad
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                P. Unitario
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                className={
                  index % 2 === 0
                    ? "bg-white hover:bg-gray-50 transition-colors"
                    : "bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
                }
              >
                <td className="px-4 py-3 text-gray-900 font-medium leading-snug">
                  {item.description}
                </td>
                <td className="px-4 py-3">
                  {item.cpcCode ? (
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="outline" className="text-xs font-mono w-fit">
                        {item.cpcCode}
                      </Badge>
                      {item.cpcDescription && (
                        <span className="text-xs text-gray-500 leading-tight">
                          {item.cpcDescription}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                  {item.quantity !== null ? item.quantity.toLocaleString("es-EC") : "—"}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 tabular-nums font-mono text-xs">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums font-mono text-xs">
                  {formatCurrency(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                  Total adjudicado
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums font-mono text-xs">
                  {formatCurrency(
                    items.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile card stack — shown only on small screens */}
      <div className="sm:hidden space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-md border border-gray-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900 leading-snug flex-1">
                {item.description}
              </p>
              <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                #{index + 1}
              </span>
            </div>

            {item.cpcCode && (
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className="text-xs font-mono w-fit">
                  {item.cpcCode}
                </Badge>
                {item.cpcDescription && (
                  <span className="text-xs text-gray-500">{item.cpcDescription}</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Cantidad</p>
                <p className="text-sm font-medium tabular-nums">
                  {item.quantity !== null ? item.quantity.toLocaleString("es-EC") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">P. Unitario</p>
                <p className="text-xs font-medium font-mono tabular-nums">
                  {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Total</p>
                <p className="text-xs font-semibold font-mono tabular-nums text-gray-900">
                  {formatCurrency(item.totalPrice)}
                </p>
              </div>
            </div>
          </div>
        ))}

        {items.length > 1 && (
          <div className="rounded-md border border-gray-300 bg-gray-50 px-4 py-3 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total adjudicado
            </span>
            <span className="text-sm font-bold font-mono text-gray-900 tabular-nums">
              {formatCurrency(
                items.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
              )}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
