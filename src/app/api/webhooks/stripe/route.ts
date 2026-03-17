import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe, priceIdToPlan } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const sig = headersList.get("stripe-signature")

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.orgId
        if (!orgId) break

        const subscriptionId = session.subscription as string
        const sub = await stripe().subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        })
        const priceId = sub.items.data[0]?.price?.id ?? ""
        const plan = priceIdToPlan(priceId) ?? "BASIC"

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: sub.status,
          },
        })
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.orgId

        // Find org by subscriptionId if no metadata
        const org = orgId
          ? await prisma.organization.findUnique({ where: { id: orgId } })
          : await prisma.organization.findUnique({ where: { stripeSubscriptionId: sub.id } })

        if (!org) break

        const priceId = sub.items.data[0]?.price?.id ?? ""
        const plan = priceIdToPlan(priceId) ?? org.plan

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            plan,
            subscriptionStatus: sub.status,
          },
        })
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription

        const org = await prisma.organization.findUnique({
          where: { stripeSubscriptionId: sub.id },
        })
        if (!org) break

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            plan: "BASIC",
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
          },
        })
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const org = await prisma.organization.findUnique({
          where: { stripeCustomerId: customerId },
          include: {
            users: {
              where: { role: "ADMIN" },
              select: { email: true, name: true },
              take: 1,
            },
          },
        })
        if (!org) break

        // Log for now — Resend email integration in Phase 5
        console.error(`[Stripe] Pago fallido para org ${org.id} (${org.name})`, {
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          adminEmail: org.users[0]?.email,
        })

        await prisma.organization.update({
          where: { id: org.id },
          data: { subscriptionStatus: "past_due" },
        })
        break
      }
    }
  } catch (err) {
    console.error("[Stripe webhook] Error procesando evento:", event.type, err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
