import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createCustomerPortalSession, getInvoices } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true },
  })

  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No hay suscripción activa. Selecciona un plan primero." },
      { status: 400 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const portalSession = await createCustomerPortalSession(
    org.stripeCustomerId,
    `${baseUrl}/configuracion?tab=billing`
  )

  return NextResponse.json({ url: portalSession.url })
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgId = (session.user as any).orgId as string

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true, plan: true, subscriptionStatus: true, stripeSubscriptionId: true },
  })

  if (!org?.stripeCustomerId) {
    return NextResponse.json({ invoices: [], plan: org?.plan ?? "BASIC" })
  }

  const invoiceList = await getInvoices(org.stripeCustomerId)
  return NextResponse.json({
    plan: org.plan,
    subscriptionStatus: org.subscriptionStatus,
    invoices: invoiceList.data.map((inv) => ({
      id: inv.id,
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      date: new Date(inv.created * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf,
    })),
  })
}
