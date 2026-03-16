"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Search, SlidersHorizontal, ChevronUp, ChevronDown, Eye, Bookmark, BookmarkCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type ContractItem = {
  id: string
  ocid: string
  title: string
  buyerName: string
  buyerProvince: string | null
  status: string
  procurementMethod: string
  ocpMethodType: string
  amountEstimated: number | null
  tenderEndDate: string | null
  publishedDate: string | null
  cpcCodes: string[]
  isTracked: boolean
  trackingStatus: string | null
}

type Pagination = { page: number; limit: number; total: number; totalPages: number }

const METHODS = [
  { value: "SUBASTA_INVERSA", label: "Subasta Inversa Electrónica", ocp: "OPEN" },
  { value: "LICITACION", label: "Licitación", ocp: "OPEN" },
  { value: "COTIZACION", label: "Cotización", ocp: "OPEN" },
  { value: "CATALOGO_ELECTRONICO", label: "Catálogo Electrónico", ocp: "OPEN" },
  { value: "MENOR_CUANTIA", label: "Menor Cuantía", ocp: "SELECTIVE" },
  { value: "CONSULTORIA_LISTA_CORTA", label: "Consultoría – Lista Corta", ocp: "LIMITED" },
  { value: "INFIMA_CUANTIA", label: "Ínfima Cuantía", ocp: "DIRECT" },
]

const STATUSES = [
  { value: "TENDER", label: "Licitación activa" },
  { value: "AWARD", label: "Adjudicado" },
  { value: "PLANNING", label: "Planificación" },
  { value: "CONTRACT", label: "Contrato" },
  { value: "CANCELLED", label: "Cancelado" },
]

const PROVINCES = [
  "Pichincha", "Guayas", "Azuay", "Manabí", "El Oro", "Los Ríos", "Imbabura",
  "Chimborazo", "Tungurahua", "Loja", "Esmeraldas", "Bolívar", "Cañar", "Carchi",
  "Cotopaxi", "Napo", "Pastaza", "Morona Santiago", "Zamora Chinchipe", "Sucumbíos",
  "Orellana", "Santo Domingo de los Tsáchilas", "Santa Elena", "Galápagos",
]

const statusBadge: Record<string, { label: string; className: string }> = {
  PLANNING: { label: "Planificación", className: "bg-gray-100 text-gray-700" },
  TENDER: { label: "Activo", className: "bg-yellow-100 text-yellow-800" },
  AWARD: { label: "Adjudicado", className: "bg-green-100 text-green-800" },
  CONTRACT: { label: "Contrato", className: "bg-blue-100 text-blue-800" },
  CANCELLED: { label: "Cancelado", className: "bg-red-100 text-red-700" },
}

const ocpBadge: Record<string, { label: string; className: string }> = {
  OPEN: { label: "OPEN", className: "bg-green-100 text-green-700" },
  SELECTIVE: { label: "SELECTIVE", className: "bg-blue-100 text-blue-700" },
  LIMITED: { label: "LIMITED", className: "bg-purple-100 text-purple-700" },
  DIRECT: { label: "DIRECT", className: "bg-gray-100 text-gray-600" },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

function buildQuery(params: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (!val) continue
    if (Array.isArray(val)) {
      val.forEach((v) => q.append(key, v))
    } else {
      q.set(key, val)
    }
  }
  return q.toString()
}

export function ContratosExplorer() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(searchParams.getAll("status[]"))
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(searchParams.getAll("province[]"))
  const [selectedMethods, setSelectedMethods] = useState<string[]>(searchParams.getAll("method[]"))
  const [myCpcOnly, setMyCpcOnly] = useState(searchParams.get("myCpcOnly") === "true")
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1"))
  const [orderBy, setOrderBy] = useState(searchParams.get("orderBy") ?? "publishedDate")
  const [orderDir, setOrderDir] = useState<"asc" | "desc">((searchParams.get("orderDir") as "asc" | "desc") ?? "desc")
  const [trackingMap, setTrackingMap] = useState<Record<string, boolean>>({})

  const debouncedSearch = useDebounce(searchInput, 300)

  const queryString = buildQuery({
    q: debouncedSearch || undefined,
    "status[]": selectedStatuses.length > 0 ? selectedStatuses : undefined,
    "province[]": selectedProvinces.length > 0 ? selectedProvinces : undefined,
    "method[]": selectedMethods.length > 0 ? selectedMethods : undefined,
    myCpcOnly: myCpcOnly ? "true" : undefined,
    page: String(page),
    orderBy,
    orderDir,
  })

  const { data, isLoading } = useQuery<{ items: ContractItem[]; pagination: Pagination }>({
    queryKey: ["contratos", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/contratos?${queryString}`)
      if (!res.ok) throw new Error("Error fetching contracts")
      return res.json()
    },
    staleTime: 30_000,
  })

  // Sync URL
  const updateUrl = useCallback(() => {
    const q = new URLSearchParams()
    if (debouncedSearch) q.set("q", debouncedSearch)
    selectedStatuses.forEach((s) => q.append("status[]", s))
    selectedProvinces.forEach((p) => q.append("province[]", p))
    selectedMethods.forEach((m) => q.append("method[]", m))
    if (myCpcOnly) q.set("myCpcOnly", "true")
    if (page > 1) q.set("page", String(page))
    if (orderBy !== "publishedDate") q.set("orderBy", orderBy)
    if (orderDir !== "desc") q.set("orderDir", orderDir)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }, [debouncedSearch, selectedStatuses, selectedProvinces, selectedMethods, myCpcOnly, page, orderBy, orderDir, router, pathname])

  useEffect(() => { updateUrl() }, [updateUrl])

  const toggleSort = (field: string) => {
    if (orderBy === field) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setOrderBy(field)
      setOrderDir("desc")
    }
    setPage(1)
  }

  const toggleCheckbox = (
    value: string,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value])
    setPage(1)
  }

  const handleFollow = async (ocid: string, isTracked: boolean) => {
    const method = isTracked ? "DELETE" : "POST"
    try {
      await fetch(`/api/contratos/${ocid}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ internalStatus: "INTERESTED" }) : undefined,
      })
      setTrackingMap((prev) => ({ ...prev, [ocid]: !isTracked }))
    } catch {
      // handle silently
    }
  }

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
      onClick={() => toggleSort(field)}
    >
      {label}
      {orderBy === field ? (
        orderDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  )

  const FiltersPanel = () => (
    <div className="space-y-6">
      {/* My CPC toggle */}
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="myCpcOnly"
            checked={myCpcOnly}
            onCheckedChange={(v) => { setMyCpcOnly(Boolean(v)); setPage(1) }}
          />
          <Label htmlFor="myCpcOnly" className="text-sm font-medium cursor-pointer">
            Solo mis CPC
          </Label>
        </div>
      </div>

      {/* Status */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</p>
        <div className="space-y-2">
          {STATUSES.map((s) => (
            <div key={s.value} className="flex items-center gap-2">
              <Checkbox
                id={`status-${s.value}`}
                checked={selectedStatuses.includes(s.value)}
                onCheckedChange={() => toggleCheckbox(s.value, selectedStatuses, setSelectedStatuses)}
              />
              <Label htmlFor={`status-${s.value}`} className="text-sm cursor-pointer">{s.label}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Method */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Método</p>
        <div className="space-y-2">
          {METHODS.map((m) => {
            const ob = ocpBadge[m.ocp] ?? { label: "OPEN", className: "bg-green-100 text-green-700" }
            return (
              <div key={m.value} className="flex items-start gap-2">
                <Checkbox
                  id={`method-${m.value}`}
                  checked={selectedMethods.includes(m.value)}
                  onCheckedChange={() => toggleCheckbox(m.value, selectedMethods, setSelectedMethods)}
                  className="mt-0.5"
                />
                <Label htmlFor={`method-${m.value}`} className="text-sm cursor-pointer flex-1">
                  <span>{m.label}</span>
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${ob.className}`}>
                    {ob.label}
                  </span>
                </Label>
              </div>
            )
          })}
        </div>
      </div>

      {/* Province */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Provincia</p>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {PROVINCES.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <Checkbox
                id={`province-${p}`}
                checked={selectedProvinces.includes(p)}
                onCheckedChange={() => toggleCheckbox(p, selectedProvinces, setSelectedProvinces)}
              />
              <Label htmlFor={`province-${p}`} className="text-sm cursor-pointer">{p}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Clear filters */}
      {(selectedStatuses.length > 0 || selectedMethods.length > 0 || selectedProvinces.length > 0 || myCpcOnly) && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setSelectedStatuses([])
            setSelectedMethods([])
            setSelectedProvinces([])
            setMyCpcOnly(false)
            setPage(1)
          }}
        >
          Limpiar filtros
        </Button>
      )}
    </div>
  )

  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por título, entidad..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        {/* Mobile filter button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtros
              {(selectedStatuses.length + selectedMethods.length + selectedProvinces.length) > 0 && (
                <Badge className="ml-2 bg-blue-600 text-white text-xs">
                  {selectedStatuses.length + selectedMethods.length + selectedProvinces.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FiltersPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Desktop filters sidebar */}
        <aside className="hidden lg:block">
          <div className="bg-white border rounded-xl p-4 sticky top-4">
            <p className="font-semibold text-gray-900 mb-4">Filtros</p>
            <FiltersPanel />
          </div>
        </aside>

        {/* Results */}
        <div className="lg:col-span-3">
          {/* Results count */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              {isLoading ? "Cargando..." : `${total.toLocaleString("es-EC")} resultado${total !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Table */}
          <div className="bg-white border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b text-xs">
              <div className="col-span-4">
                <SortHeader field="title" label="Título" />
              </div>
              <div className="col-span-3">
                <SortHeader field="buyerName" label="Entidad" />
              </div>
              <div className="col-span-2 text-right">
                <SortHeader field="amountEstimated" label="Monto" />
              </div>
              <div className="col-span-2 text-right">
                <SortHeader field="tenderEndDate" label="Fecha límite" />
              </div>
              <div className="col-span-1" />
            </div>

            {isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Sin resultados</p>
                <p className="text-sm text-gray-400 mt-1">Intenta ajustar los filtros o la búsqueda</p>
              </div>
            ) : (
              <div className="divide-y">
                {data!.items.map((item) => {
                  const sb = statusBadge[item.status] ?? { label: "Planificación", className: "bg-gray-100 text-gray-700" }
                  const ob = ocpBadge[item.ocpMethodType] ?? { label: "OPEN", className: "bg-green-100 text-green-700" }
                  const isTracked = item.ocid in trackingMap
                    ? Boolean(trackingMap[item.ocid])
                    : item.isTracked

                  return (
                    <div
                      key={item.ocid}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3.5 hover:bg-gray-50 transition-colors items-center"
                    >
                      <div className="md:col-span-4 min-w-0">
                        <Link href={`/contratos/${item.ocid}`} className="hover:underline">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.title}</p>
                        </Link>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ob.className}`}>
                            {ob.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.className}`}>
                            {sb.label}
                          </span>
                        </div>
                      </div>
                      <div className="md:col-span-3 min-w-0">
                        <p className="text-sm text-gray-600 truncate">{item.buyerName}</p>
                        {item.buyerProvince && (
                          <p className="text-xs text-gray-400 truncate">{item.buyerProvince}</p>
                        )}
                      </div>
                      <div className="md:col-span-2 md:text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.amountEstimated ? formatCurrency(item.amountEstimated) : "—"}
                        </p>
                      </div>
                      <div className="md:col-span-2 md:text-right">
                        <p className="text-xs text-gray-500">
                          {item.tenderEndDate ? formatDate(item.tenderEndDate) : "—"}
                        </p>
                      </div>
                      <div className="md:col-span-1 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={isTracked ? "Dejar de seguir" : "Seguir"}
                          onClick={() => handleFollow(item.ocid, isTracked)}
                        >
                          {isTracked ? (
                            <BookmarkCheck className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Bookmark className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/contratos/${item.ocid}`}>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <p className="text-sm text-gray-500">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
