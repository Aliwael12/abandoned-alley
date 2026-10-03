import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  checkoutIdOf,
  fulfillCheckoutSession,
  getStripe,
  isStripeConfigured,
  releaseCheckout,
} from "@/lib/stripe-server";

export const runtime = "nodejs";

// Stripe's event destination for this site (Workbench → Webhooks), subscribed
// to the four checkout.session events handled below. Fulfillment also runs
// when the shopper lands back on /cart; this is the path that still works when
// they don't (closed tab, lost connection) — see lib/stripe-server.ts.
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  // Signature verification needs the body byte-for-byte as Stripe sent it.
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.warn("Rejected a Stripe webhook with a bad signature:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await fulfillCheckoutSession(event.data.object.id);
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const checkoutId = checkoutIdOf(event.data.object);
        if (checkoutId) {
          await releaseCheckout(
            checkoutId,
            event.type === "checkout.session.expired" ? "expired" : "payment_failed"
          );
        }
        break;
      }
    }
  } catch (err) {
    // A non-2xx makes Stripe retry the delivery (for up to three days), and
    // every handler above is idempotent, so a transient failure heals itself.
    console.error(`Stripe webhook ${event.type} (${event.id}) failed:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
