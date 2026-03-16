"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

type Props = { endDate: string }

export function CountdownTimer({ endDate }: Props) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft("Plazo vencido"); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      if (d > 0) setTimeLeft(`${d}d ${h}h restantes`)
      else if (h > 0) setTimeLeft(`${h}h ${m}m restantes`)
      else setTimeLeft(`${m}m restantes`)
    }
    calc()
    const interval = setInterval(calc, 60000)
    return () => clearInterval(interval)
  }, [endDate])

  const diff = new Date(endDate).getTime() - Date.now()
  const urgentColor = diff < 86400000 ? "text-red-600" : diff < 7 * 86400000 ? "text-orange-600" : "text-green-600"

  return (
    <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${urgentColor}`}>
      <Clock className="h-3.5 w-3.5" />
      {timeLeft}
    </div>
  )
}
