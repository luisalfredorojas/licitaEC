"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserPlus, Trash2, Shield, User } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface OrgUser {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "MEMBER"
  lastLoginAt: string | null
  createdAt: string
}

export function UsuariosTab() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = session?.user as any
  const isAdmin = currentUser?.role === "ADMIN"

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ users: OrgUser[] }>({
    queryKey: ["org-users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      return res.json()
    },
  })

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, name: inviteName || undefined, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al invitar")
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] })
      setInviteSuccess(
        `Usuario creado. Contraseña temporal: ${data.tempPassword} (se envió por email si Resend está configurado)`
      )
      setInviteEmail("")
      setInviteName("")
    },
    onError: (err: Error) => setInviteError(err.message),
  })

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "ADMIN" | "MEMBER" }) => {
      await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-users"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Error al eliminar")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-users"] }),
  })

  const users = data?.users ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => { setInviteOpen(true); setInviteError(null); setInviteSuccess(null) }}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invitar usuario
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Rol</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Último acceso</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium flex-shrink-0">
                        {(user.name ?? user.email)[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name ?? "—"}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && user.id !== currentUser?.id ? (
                      <Select
                        defaultValue={user.role}
                        onValueChange={(val) =>
                          roleMutation.mutate({ id: user.id, role: val as "ADMIN" | "MEMBER" })
                        }
                      >
                        <SelectTrigger className="w-28 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">
                            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</span>
                          </SelectItem>
                          <SelectItem value="MEMBER">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" /> Miembro</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={user.role === "ADMIN" ? "default" : "secondary"} className="text-xs">
                        {user.role === "ADMIN" ? "Admin" : "Miembro"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {user.lastLoginAt ? formatDate(new Date(user.lastLoginAt)) : "Nunca"}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${user.email}?`)) deleteMutation.mutate(user.id)
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre (opcional)</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "ADMIN" | "MEMBER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Miembro</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600 bg-green-50 p-2 rounded">{inviteSuccess}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
