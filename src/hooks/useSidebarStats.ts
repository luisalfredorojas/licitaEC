"use client"

import { useQuery } from "@tanstack/react-query"

type SidebarStats = {
  nuevosHoy: number
  porVencer: number
  enPipeline: number
  alertasSinLeer: number
  lastSync: Date | null
}

export function useSidebarStats() {
  const { data: stats, isLoading } = useQuery<SidebarStats>({
    queryKey: ["sidebar-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats")
      if (!res.ok) throw new Error("Error fetching stats")
      return res.json()
    },
    refetchInterval: 60_000, // refresh every minute
    staleTime: 30_000,
  })

  return { stats, isLoading }
}
