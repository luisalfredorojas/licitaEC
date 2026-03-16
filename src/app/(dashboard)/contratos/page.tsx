import { Suspense } from "react"
import { ContratosExplorer } from "@/components/contratos/ContratosExplorer"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Contratos" }

export default function ContratosPage() {
  return (
    <Suspense fallback={<ContratosLoadingSkeleton />}>
      <ContratosExplorer />
    </Suspense>
  )
}

function ContratosLoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Skeleton className="h-96 lg:col-span-1" />
        <div className="lg:col-span-3 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
