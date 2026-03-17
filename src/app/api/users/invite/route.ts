import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPlanLimits, userLimitError } from "@/lib/plan-guard"
import { SubscriptionPlan } from "@prisma/client"
import { z } from "zod"
import { Resend } from "resend"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string
  const plan = user.plan as SubscriptionPlan

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden invitar usuarios" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { email, name, role } = parsed.data

  // Check user limit for plan
  const limits = getPlanLimits(plan)
  const currentCount = await prisma.user.count({ where: { orgId } })
  if (currentCount >= limits.maxUsers) {
    return userLimitError(plan)
  }

  // Check if user already exists in this org
  const existing = await prisma.user.findFirst({ where: { orgId, email } })
  if (existing) {
    return NextResponse.json({ error: "Este email ya pertenece a la organización" }, { status: 409 })
  }

  // Generate temp password
  const tempPassword = crypto.randomBytes(8).toString("hex")
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  })

  const newUser = await prisma.user.create({
    data: { orgId, email, name: name ?? null, role, passwordHash },
    select: { id: true, email: true, name: true, role: true },
  })

  // Send invite email with Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      await resend.emails.send({
        from: `LicitaEC <noreply@${process.env.EMAIL_FROM_DOMAIN ?? "licitaec.com"}>`,
        to: email,
        subject: `Invitación a ${org?.name ?? "LicitaEC"}`,
        html: `
          <h2>Has sido invitado a ${org?.name ?? "LicitaEC"}</h2>
          <p>Hola ${name ?? email},</p>
          <p>Tu cuenta ha sido creada. Usa las siguientes credenciales para acceder:</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Contraseña temporal:</strong> ${tempPassword}</p>
          <p>Por favor cambia tu contraseña después de iniciar sesión.</p>
          <a href="${appUrl}/login" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:12px">
            Iniciar sesión
          </a>
        `,
      })
    } catch (emailErr) {
      console.error("[Invite] Error enviando email:", emailErr)
      // Don't fail the request if email fails
    }
  }

  return NextResponse.json({ user: newUser, tempPassword }, { status: 201 })
}
