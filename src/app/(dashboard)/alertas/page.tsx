import { Suspense } from "react"
import { AlertasView } from "@/components/alertas/AlertasView"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Alertas" }

export default function AlertasPage() {
  return (
    <Suspense fallback={<AlertasLoadingSkeleton />}>
      <AlertasView />
    </Suspense>
  )
}

function AlertasLoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}
