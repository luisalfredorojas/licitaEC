import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, createCheckoutSession, createOrRetrieveCustomer, STRIPE_PRICES } from "@/lib/stripe"
import { z } from "zod"

const schema = z.object({
  plan: z.enum(["PROFESSIONAL", "ENTERPRISE"]),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any
  const orgId = user.orgId as string

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Plan inválido" }, { status: 400 })

  const { plan } = parsed.data

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { users: { where: { role: "ADMIN" }, select: { email: true }, take: 1 } },
  })
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 })

  // Create or retrieve Stripe customer
  let customerId: string = org.stripeCustomerId ?? ""
  if (!org.stripeCustomerId) {
    const adminEmail = org.users[0]?.email ?? user.email ?? ""
    const customer = await createOrRetrieveCustomer(orgId, adminEmail, org.name)
    customerId = customer.id
    await prisma.organization.update({ where: { id: orgId }, data: { stripeCustomerId: customerId } })
  }

  // If already subscribed, update subscription instead of new checkout
  if (org.stripeSubscriptionId) {
    const sub = await stripe().subscriptions.retrieve(org.stripeSubscriptionId)
    const priceId = STRIPE_PRICES[plan]
    await stripe().subscriptions.update(org.stripeSubscriptionId, {
      items: [{ id: sub.items.data[0]?.id, price: priceId }],
      proration_behavior: "create_prorations",
    })
    return NextResponse.json({ upgraded: true })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const checkoutSession = await createCheckoutSession({
    customerId,
    priceId: STRIPE_PRICES[plan],
    orgId,
    successUrl: `${baseUrl}/dashboard?upgrade=success`,
    cancelUrl: `${baseUrl}/configuracion?tab=billing`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
