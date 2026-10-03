import { NextResponse } from "next/server";
import { fulfillCheckoutSession, isStripeConfigured } from "@/lib/stripe-server";

export const runtime = "nodejs";

/**
 * Called by /cart when Stripe sends the shopper back after paying. Places the
 * order right away instead of waiting for the webhook, and tells the page what
 * to show. Safe to call for any session id: nothing happens unless Stripe
 * itself reports the session paid.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Card payments are unavailable." }, { status: 503 });
  }

  let sessionId = "";
  try {
    const body = (await request.json()) as { sessionId?: unknown };
    sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  } catch {
    // fall through to the format check
  }
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    const result = await fulfillCheckoutSession(sessionId);
    if (!result) {
      return NextResponse.json({ error: "Unknown session" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(`Confirming Stripe session ${sessionId} failed:`, err);
    return NextResponse.json(
      { error: "We couldn't confirm your payment yet." },
      { status: 500 }
    );
  }
}
