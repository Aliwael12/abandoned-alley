// Card payments for the New York store, through Stripe-hosted Checkout — card
// details never touch this site.
//
// A US card order starts life as a /checkouts document, created in the same
// transaction that reserves its stock (see /api/checkout). It only becomes an
// /orders document once Stripe confirms the payment, so the admin dashboard,
// analytics, and order emails never see an order nobody paid for. A checkout
// the shopper walks away from gives its stock back when its Stripe session
// expires (or straight away, if they come back to the site via Cancel).
//
// Fulfillment runs from both the webhook and the shopper's return to /cart, so
// every step here is idempotent: whichever arrives second finds the work done.

import Stripe from "stripe";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isAdmin } from "@/lib/admin-auth";
import { placedAtLabel, sendOrderPlacedEmails, type OrderForEmail } from "@/lib/email";
import { toRegion } from "@/lib/pricing";
import {
  parseStockDeducted,
  readProductsForItems,
  writeRestores,
  type RawOrderItem,
} from "@/lib/stock-reservation";

/** Card checkouts awaiting payment. Same id as the order they turn into. */
export const CHECKOUTS = "checkouts";

/**
 * Stock is held while the shopper pays, so don't leave it locked for Stripe's
 * default 24 hours. 30 minutes is the shortest Stripe allows; the extra minute
 * absorbs clock drift between us and Stripe.
 */
const SESSION_LIFETIME_SECONDS = 31 * 60;

/** The order-document fields a checkout carries over when it is paid. */
const ORDER_FIELDS = [
  "customer",
  "shipping",
  "items",
  "notes",
  "subtotal",
  "discountAmount",
  "promoCode",
  "shippingFee",
  "shippingZone",
  "droppinAutoPush",
  "region",
  "currency",
  "attribution",
] as const;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** Sandbox keys (sk_test_ / rk_test_) can't take real money. */
function isTestMode(): boolean {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

/**
 * Whether US checkout takes payment by card. A sandbox account can't charge a
 * real card, so while the keys are test keys only a logged-in admin gets the
 * Stripe flow — shoppers keep placing orders for manual follow-up, and the
 * integration can be tried on the live site without blocking real orders.
 */
export async function isCardCheckoutEnabled(): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  return !isTestMode() || (await isAdmin());
}

const toCents = (amount: number) => Math.round(amount * 100);

/** Stripe fetches line-item images itself, so only pass clean absolute URLs. */
function stripeImage(src: string | undefined, origin: string): string | undefined {
  if (!src || /\s/.test(src)) return undefined;
  try {
    const url = new URL(src, origin);
    return url.protocol === "https:" && url.href.length <= 2000 ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export type CardCheckoutInput = {
  checkoutId: string;
  email: string;
  items: {
    title: string;
    variantTitle: string;
    price: number;
    quantity: number;
    image?: string;
  }[];
  discountAmount: number;
  promoCode: string | null;
  /** The site's origin, for Stripe's return URLs and relative image paths. */
  origin: string;
};

/** Open a hosted Checkout session for a checkout already holding its stock. */
export async function createCheckoutSession(
  input: CardCheckoutInput
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  // Promo codes are this shop's own (see lib/promo-codes.ts), already applied
  // to the amounts. Stripe only needs the resulting amount off, as a single-use
  // coupon, so its page and receipt show the same total as the order.
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  const amountOff = toCents(input.discountAmount);
  if (amountOff > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: amountOff,
      currency: "usd",
      duration: "once",
      max_redemptions: 1,
      name: (input.promoCode ?? "Discount").slice(0, 40),
      metadata: { checkoutId: input.checkoutId },
    });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: input.items.map((item) => {
        const image = stripeImage(item.image, input.origin);
        return {
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: toCents(item.price),
            product_data: {
              name: `${item.title} — ${item.variantTitle}`.slice(0, 250),
              ...(image ? { images: [image] } : {}),
            },
          },
        };
      }),
      discounts,
      customer_email: input.email,
      client_reference_id: input.checkoutId,
      metadata: { checkoutId: input.checkoutId },
      payment_intent_data: {
        description: `Abandoned Alley order ${input.checkoutId}`,
        metadata: { checkoutId: input.checkoutId },
      },
      success_url: `${input.origin}/cart?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}/cart?step=checkout&cancelled=${input.checkoutId}`,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    },
    // A retried request must not open a second session for the same checkout.
    { idempotencyKey: `checkout-session-${input.checkoutId}` }
  );
  if (!session.url) throw new Error("Stripe returned a session without a URL.");
  return session;
}

/** Our checkout id on a Stripe session, or null for sessions this site didn't create. */
export function checkoutIdOf(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.checkoutId ?? session.client_reference_id ?? null;
}

/**
 * Give a checkout's stock back and close it. Only an open checkout holds
 * stock; one already paid or released is left alone, so this is safe to call
 * from the webhook and the cancel route at once.
 */
export async function releaseCheckout(
  checkoutId: string,
  reason: "expired" | "cancelled" | "payment_failed" | "session_failed"
): Promise<void> {
  const ref = doc(db, CHECKOUTS, checkoutId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const checkout = snap.data() as Record<string, unknown>;
    if (checkout.status !== "open") return;

    const held = parseStockDeducted(checkout.stockDeducted);
    if (held) {
      const items = Array.isArray(checkout.items) ? (checkout.items as RawOrderItem[]) : [];
      const reads = await readProductsForItems(tx, items, toRegion(checkout.region));
      writeRestores(tx, held, reads);
    }
    tx.update(ref, {
      status: "released",
      releasedAt: serverTimestamp(),
      releaseReason: reason,
    });
  });
}

/**
 * Turn a paid checkout into an order. Returns the new order's fields, or null
 * when an earlier call already placed it.
 */
async function placePaidOrder(
  checkoutId: string,
  session: Stripe.Checkout.Session
): Promise<Record<string, unknown> | null> {
  const checkoutRef = doc(db, CHECKOUTS, checkoutId);
  const orderRef = doc(db, "orders", checkoutId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(checkoutRef);
    if (!snap.exists()) throw new Error(`Checkout ${checkoutId} not found.`);
    const checkout = snap.data() as Record<string, unknown>;
    if (checkout.status === "paid") return null;

    const order: Record<string, unknown> = {};
    for (const key of ORDER_FIELDS) {
      if (key in checkout) order[key] = checkout[key];
    }
    // An open checkout hands its reserved stock to the order. A released one
    // already gave it back — Stripe shouldn't let an expired session be paid,
    // but if it ever is, the order holds no stock and approving it deducts
    // the stock then, just like an order placed before checkout reserved it.
    if (checkout.status === "open") {
      order.stockDeducted = checkout.stockDeducted;
    } else {
      console.error(
        `Checkout ${checkoutId} was paid after it was ${String(checkout.status)}; ` +
          "its stock was already released and will be re-deducted on approval."
      );
    }
    const paymentIntent = session.payment_intent;
    Object.assign(order, {
      status: "pending",
      createdAt: serverTimestamp(),
      paymentMethod: "card",
      paymentStatus: "paid",
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null,
      amountPaid: (session.amount_total ?? 0) / 100,
      paidAt: serverTimestamp(),
    });

    tx.set(orderRef, order);
    tx.update(checkoutRef, {
      status: "paid",
      paidAt: serverTimestamp(),
      stripeSessionId: session.id,
    });
    return order;
  });
}

function emailPayload(id: string, order: Record<string, unknown>): OrderForEmail {
  const customer = (order.customer ?? {}) as Record<string, string>;
  const promoCode = typeof order.promoCode === "string" ? order.promoCode : undefined;
  const notes = typeof order.notes === "string" ? order.notes : undefined;
  return {
    id,
    currency: String(order.currency ?? "USD"),
    customerName: customer.name ?? "",
    customerEmail: customer.email ?? "",
    customerPhone: customer.phone ?? "",
    shipping: order.shipping as OrderForEmail["shipping"],
    notes,
    items: order.items as OrderForEmail["items"],
    subtotal: Number(order.subtotal ?? 0),
    discountAmount: Number(order.discountAmount ?? 0),
    promoCode,
    shippingFee: Number(order.shippingFee ?? 0),
    placedAt: placedAtLabel(),
    paid: true,
  };
}

export type CardCheckoutResult = {
  orderId: string;
  /** What Stripe charged, in dollars. */
  total: number;
  /** False while a delayed payment method is still processing. */
  paid: boolean;
};

/**
 * Place the order for a completed Checkout session, if it's paid and not
 * placed yet, and send the order emails the first time. Returns null for a
 * session this site didn't create.
 */
export async function fulfillCheckoutSession(
  sessionId: string
): Promise<CardCheckoutResult | null> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const checkoutId = checkoutIdOf(session);
  if (!checkoutId) return null;

  const total = (session.amount_total ?? 0) / 100;
  if (session.payment_status === "unpaid") {
    return { orderId: checkoutId, total, paid: false };
  }

  const placed = await placePaidOrder(checkoutId, session);
  if (placed) {
    await sendOrderPlacedEmails(emailPayload(checkoutId, placed), toRegion(placed.region));
  }
  return { orderId: checkoutId, total, paid: true };
}

/**
 * The shopper backed out of Stripe's page. Expire the session so it can't be
 * paid any more, then release the stock now instead of in half an hour — so
 * resubmitting the same bag isn't told its own held items are sold out.
 */
export async function abandonCheckout(checkoutId: string): Promise<void> {
  const snap = await getDoc(doc(db, CHECKOUTS, checkoutId));
  if (!snap.exists()) return;
  const checkout = snap.data() as Record<string, unknown>;
  const sessionId = checkout.stripeSessionId;
  if (checkout.status !== "open" || typeof sessionId !== "string") return;

  const stripe = getStripe();
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch {
    // Already expired or completed — the session's own status decides below.
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === "expired") {
    await releaseCheckout(checkoutId, "cancelled");
  } else if (session.status === "complete") {
    await fulfillCheckoutSession(sessionId);
  }
}

export type CardPaymentSummary = {
  /** Stripe's PaymentIntent status — "succeeded" means the money is in. */
  status: string;
  amountReceived: number;
  amountRefunded: number;
  currency: string;
  /** Link to the payment in the Stripe dashboard. */
  dashboardUrl: string;
};

/**
 * What Stripe itself says about an order's payment. The admin page shows this
 * rather than the order's own "paid" flag, which the open Firestore rules
 * leave writable by anyone.
 */
export async function getCardPaymentSummary(
  paymentIntentId: string
): Promise<CardPaymentSummary> {
  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  return {
    status: pi.status,
    amountReceived: pi.amount_received / 100,
    amountRefunded: (charge?.amount_refunded ?? 0) / 100,
    currency: pi.currency.toUpperCase(),
    dashboardUrl: `https://dashboard.stripe.com/${pi.livemode ? "" : "test/"}payments/${pi.id}`,
  };
}

/**
 * Refund a card order in full. The idempotency key ties the refund to the
 * order, so retrying after a failure further down (the status write) returns
 * the same refund instead of refunding twice.
 */
export async function refundCardPayment(
  orderId: string,
  paymentIntentId: string
): Promise<Stripe.Refund> {
  return getStripe().refunds.create(
    { payment_intent: paymentIntentId, metadata: { orderId } },
    { idempotencyKey: `refund-order-${orderId}` }
  );
}
