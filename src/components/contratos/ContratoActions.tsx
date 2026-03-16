"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Bookmark, BookmarkCheck } from "lucide-react"

type TrackingData = { internalStatus: string } | null

type Props = {
  ocid: string
  orgId: string
  initialTracking: TrackingData
}

export function ContratoActions({ ocid, initialTracking }: Props) {
  const [isTracked, setIsTracked] = useState(initialTracking !== null)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const method = isTracked ? "DELETE" : "POST"
      const res = await fetch(`/api/contratos/${ocid}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ internalStatus: "INTERESTED" }) : undefined,
      })
      if (res.ok) setIsTracked(!isTracked)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={isTracked ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      {isTracked ? (
        <>
          <BookmarkCheck className="h-4 w-4 mr-2" />
          En seguimiento
        </>
      ) : (
        <>
          <Bookmark className="h-4 w-4 mr-2" />
          Seguir este proceso
        </>
      )}
    </Button>
  )
}
