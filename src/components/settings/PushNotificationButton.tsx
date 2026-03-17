"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, Loader2 } from "lucide-react"

export function PushNotificationButton() {
  const [status, setStatus] = useState<"unsupported" | "denied" | "granted" | "default">("default")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported")
      return
    }
    setStatus(Notification.permission as "denied" | "granted" | "default")
  }, [])

  async function getVapidKey(): Promise<string> {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
  }

  function urlB64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const arr = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
    return arr.buffer
  }

  async function subscribe() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus("denied")
        return
      }

      const vapidKey = await getVapidKey()
      if (!vapidKey) {
        alert("Push no configurado. Agrega NEXT_PUBLIC_VAPID_PUBLIC_KEY al .env.local")
        return
      }

      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidKey),
      })

      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      })

      setStatus("granted")
    } catch (err) {
      console.error("Error subscribing to push:", err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js")
      if (!reg) return

      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus("default")
    } finally {
      setLoading(false)
    }
  }

  if (status === "unsupported") {
    return <p className="text-xs text-gray-400">Tu navegador no soporta notificaciones push.</p>
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-amber-600">
        Notificaciones bloqueadas. Habilítalas en la configuración de tu navegador.
      </p>
    )
  }

  if (status === "granted") {
    return (
      <Button variant="outline" size="sm" onClick={unsubscribe} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <BellOff className="h-3.5 w-3.5 mr-1.5" />}
        Desactivar notificaciones
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={subscribe} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Bell className="h-3.5 w-3.5 mr-1.5" />}
      Activar notificaciones
    </Button>
  )
}
