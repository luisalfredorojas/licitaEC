"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, Search } from "lucide-react"
import { getPlanLimits } from "@/lib/plan-guard"
import { SubscriptionPlan } from "@prisma/client"

interface CpcCode {
  id: string
  cpcCode: string
  cpcDescription: string | null
  addedAt: string
}

interface SearchResult {
  code: string
  description: string
}

export function CpcTab() {
  const { data: session } = useSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = ((session?.user as any)?.plan ?? "BASIC") as SubscriptionPlan
  const limits = getPlanLimits(plan)

  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ cpcCodes: CpcCode[] }>({
    queryKey: ["org-cpc"],
    queryFn: async () => {
      const res = await fetch("/api/cpc/list")
      if (!res.ok) {
        // fallback: get from org
        return { cpcCodes: [] }
      }
      return res.json()
    },
  })

  // Use the org CPC from a separate dedicated endpoint
  const { data: orgCpcData } = useQuery<{ cpcCodes: CpcCode[] }>({
    queryKey: ["org-cpc-list"],
    queryFn: async () => {
      const res = await fetch("/api/cpc/list")
      return res.json()
    },
  })

  const codes = orgCpcData?.cpcCodes ?? data?.cpcCodes ?? []
  const atLimit = limits.maxCpcCodes !== Infinity && codes.length >= limits.maxCpcCodes

  async function handleSearch(q: string) {
    setSearch(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/cpc?q=${encodeURIComponent(q)}`)
      const d = await res.json()
      setSearchResults(d.results ?? [])
    } finally {
      setSearching(false)
    }
  }

  const addMutation = useMutation({
    mutationFn: async (item: SearchResult) => {
      const res = await fetch("/api/cpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpcCode: item.code, cpcDescription: item.description }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? "Error al agregar")
      return d
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-cpc-list"] })
      setSearch("")
      setSearchResults([])
      setAddError(null)
    },
    onError: (err: Error) => setAddError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/cpc/${id}`, { method: "DELETE" })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-cpc-list"] }),
  })

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Códigos CPC</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-medium ${atLimit ? "text-red-600" : "text-gray-700"}`}>
            {codes.length}
            {limits.maxCpcCodes !== Infinity ? `/${limits.maxCpcCodes}` : ""}
          </span>
          <Badge variant={atLimit ? "destructive" : "secondary"} className="text-xs">
            Plan {plan.charAt(0) + plan.slice(1).toLowerCase()}
          </Badge>
        </div>
      </div>

      {atLimit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          Has alcanzado el límite de {limits.maxCpcCodes} códigos CPC para tu plan.{" "}
          <a href="/configuracion?tab=billing" className="underline font-medium">
            Actualiza tu plan
          </a>{" "}
          para agregar más.
        </div>
      )}

      {/* Search to add */}
      {!atLimit && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Buscar código CPC para agregar..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden divide-y max-h-48 overflow-y-auto">
              {searchResults.map((r) => {
                const alreadyAdded = codes.some((c) => c.cpcCode === r.code)
                return (
                  <div key={r.code} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                    <div>
                      <span className="font-mono text-sm font-medium">{r.code}</span>
                      <p className="text-xs text-gray-500">{r.description}</p>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-xs text-gray-400">Ya agregado</span>
                    ) : (
                      <button
                        onClick={() => addMutation.mutate(r)}
                        disabled={addMutation.isPending}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {addError && <p className="text-sm text-red-500">{addError}</p>}
        </div>
      )}

      {/* Current codes */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : codes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No tienes códigos CPC configurados.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y">
          {codes.map((code) => (
            <div key={code.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-mono text-sm font-semibold text-gray-900">{code.cpcCode}</span>
                {code.cpcDescription && (
                  <p className="text-xs text-gray-500 mt-0.5">{code.cpcDescription}</p>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(code.id)}
                className="text-gray-300 hover:text-red-500 ml-3"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
