import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  name: z.string().min(2).max(80).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = session.user as any
  if (currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden modificar usuarios" }, { status: 403 })
  }

  const orgId = currentUser.orgId as string
  const { id } = await params

  const target = await prisma.user.findFirst({ where: { id, orgId } })
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, email: true, name: true, role: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = session.user as any
  if (currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden eliminar usuarios" }, { status: 403 })
  }

  const orgId = currentUser.orgId as string
  const { id } = await params

  // Cannot delete yourself
  if (id === currentUser.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 })
  }

  const target = await prisma.user.findFirst({ where: { id, orgId } })
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
