import { NextResponse } from "next/server";
import { abandonCheckout, isStripeConfigured } from "@/lib/stripe-server";

export const runtime = "nodejs";

/**
 * Called by /cart when the shopper backs out of Stripe's payment page. Expires
 * the session and releases the checkout's stock immediately, so resubmitting
 * the same bag isn't blocked by the items this checkout was still holding.
 * Without this call the stock still comes back when the session expires.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) return NextResponse.json({ ok: true });

  let checkoutId = "";
  try {
    const body = (await request.json()) as { orderId?: unknown };
    checkoutId = typeof body.orderId === "string" ? body.orderId : "";
  } catch {
    // fall through to the format check
  }
  // Firestore auto-ids: 20 alphanumerics.
  if (!/^[A-Za-z0-9]{10,40}$/.test(checkoutId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  try {
    await abandonCheckout(checkoutId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Abandoning checkout ${checkoutId} failed:`, err);
    return NextResponse.json({ error: "Could not cancel" }, { status: 500 });
  }
}
