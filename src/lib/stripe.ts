import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export const STRIPE_PRICES = {
  BASIC: process.env.STRIPE_PRICE_BASIC!,
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL!,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE!,
} as const;

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
  return stripe.checkout.sessions.create({
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
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
