import Stripe from "stripe";

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
}

// Lazy singleton
let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) _stripe = getStripe();
  return _stripe;
}

export const STRIPE_PRICES = {
  get BASIC() { return process.env.STRIPE_PRICE_BASIC ?? ""; },
  get PROFESSIONAL() { return process.env.STRIPE_PRICE_PROFESSIONAL ?? ""; },
  get ENTERPRISE() { return process.env.STRIPE_PRICE_ENTERPRISE ?? ""; },
} as const;

// Map Stripe price IDs to plan names
export function priceIdToPlan(priceId: string): "BASIC" | "PROFESSIONAL" | "ENTERPRISE" | null {
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "BASIC";
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return "PROFESSIONAL";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "ENTERPRISE";
  return null;
}

export async function createOrRetrieveCustomer(orgId: string, email: string, orgName: string): Promise<Stripe.Customer> {
  const client = stripe();
  const existing = await client.customers.search({
    query: `metadata['orgId']:'${orgId}'`,
    limit: 1,
  });
  if (existing.data.length > 0) return existing.data[0] as Stripe.Customer;

  return client.customers.create({
    email,
    name: orgName,
    metadata: { orgId },
  });
}

export async function createCheckoutSession({
  customerId,
  priceId,
  orgId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  orgId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orgId },
    allow_promotion_codes: true,
  });
}

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  return stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function getSubscriptionStatus(subscriptionId: string) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const priceId = sub.items.data[0]?.price?.id ?? null;
  return {
    status: sub.status,
    plan: priceId ? priceIdToPlan(priceId) : null,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };
}

export async function getInvoices(customerId: string, limit = 10) {
  return stripe().invoices.list({ customer: customerId, limit });
}
