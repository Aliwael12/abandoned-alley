import { NextResponse } from "next/server";
import { newId, sql, withJson } from "@/lib/db";
import { placedAtLabel, sendOrderPlacedEmails, type OrderForEmail } from "@/lib/email";
import { getOfferConfig, getShippingFees } from "@/lib/settings-server";
import { checkoutTotals, isOfferLive, type CheckoutTotals } from "@/lib/offer";
import {
  COUNTRY_EGYPT,
  COUNTRY_USA,
  feeForZone,
  isEgyptGovernorate,
  resolveZone,
} from "@/lib/shipping";
import { REGION_CURRENCY, toRegion, type Region } from "@/lib/pricing";
import {
  InsufficientStockError,
  deductionsByProduct,
  findShortfalls,
  readProductsForItems,
  writeDeductions,
} from "@/lib/stock-reservation";
import { isDroppinConfigured } from "@/lib/droppin";
import { pushOrderToDroppin } from "@/lib/orders-server";
import { getPromoCodeByCode } from "@/lib/promo-codes-server";
import {
  computePromoDiscount,
  normalizePromoCode,
  validatePromo,
  type PromoCode,
} from "@/lib/promo-codes";
import { UnpricedItemError, priceItems } from "@/lib/order-pricing";
import {
  CHECKOUTS,
  ORDER_JSON_COLUMNS,
  createCheckoutSession,
  isCardCheckoutEnabled,
  releaseCheckout,
} from "@/lib/stripe-server";

export const runtime = "nodejs";

/** A bag line as the client sends it. There's no price: checkout prices every
 * line from the product documents (see lib/order-pricing.ts). */
type IncomingItem = {
  productHandle: string;
  variantId: string;
  title: string;
  variantTitle: string;
  quantity: number;
};

type AttributionIn = {
  sessionId: string | null;
  referrer: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    term: string | null;
  };
};

type IncomingOrder = {
  region: Region;
  customer: { name: string; email: string; phone: string };
  shipping: {
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  notes?: string;
  items: IncomingItem[];
  attribution?: AttributionIn;
  promoCode?: string;
  /** The cart showed the spend offer — so if it has since ended, say so. */
  offerExpected: boolean;
};

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function validate(body: unknown): IncomingOrder | string {
  if (!body || typeof body !== "object") return "Invalid body";
  const b = body as Record<string, unknown>;

  const customer = b.customer as Record<string, unknown> | undefined;
  if (!customer) return "Missing customer";
  const name = String(customer.name ?? "").trim();
  const email = String(customer.email ?? "").trim();
  const phone = String(customer.phone ?? "").trim();
  if (!name) return "Name required";
  if (!isValidEmail(email)) return "Valid email required";
  if (!phone) return "Phone required";

  const shipping = b.shipping as Record<string, unknown> | undefined;
  if (!shipping) return "Missing shipping";
  const ship = {
    address: String(shipping.address ?? "").trim(),
    city: String(shipping.city ?? "").trim(),
    state: String(shipping.state ?? "").trim(),
    zip: String(shipping.zip ?? "").trim(),
    country: String(shipping.country ?? "").trim(),
  };
  // ZIP is optional (rarely used in Egypt); everything else is required.
  for (const [k, v] of Object.entries(ship)) {
    if (k !== "zip" && !v) return `Shipping ${k} required`;
  }
  // The region decides which address rules apply and which currency the order
  // is booked in. The server is authoritative about the destination country.
  const region = toRegion(b.region);
  if (region === "us") {
    if (!ship.zip) return "ZIP code required";
    ship.country = COUNTRY_USA;
  } else {
    if (resolveZone(ship.country, ship.state) === "international") {
      return "We currently deliver within Egypt only.";
    }
    if (!isEgyptGovernorate(ship.state)) {
      return "Please select a valid Egyptian governorate.";
    }
    ship.country = COUNTRY_EGYPT;
  }

  const items = b.items;
  if (!Array.isArray(items) || items.length === 0) return "Cart is empty";
  const cleanItems: IncomingItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return "Invalid item";
    const it = raw as Record<string, unknown>;
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return "Invalid quantity";
    cleanItems.push({
      productHandle: String(it.productHandle ?? ""),
      variantId: String(it.variantId ?? ""),
      title: String(it.title ?? "").slice(0, 200),
      variantTitle: String(it.variantTitle ?? ""),
      quantity: qty,
    });
  }

  let attribution: AttributionIn | undefined;
  const attrRaw = b.attribution;
  if (attrRaw && typeof attrRaw === "object") {
    const a = attrRaw as Record<string, unknown>;
    const utmRaw = (a.utm ?? {}) as Record<string, unknown>;
    const str = (v: unknown, max = 120) =>
      typeof v === "string" && v.length ? v.slice(0, max) : null;
    attribution = {
      sessionId: str(a.sessionId, 64),
      referrer: str(a.referrer, 500),
      utm: {
        source: str(utmRaw.source, 80),
        medium: str(utmRaw.medium, 80),
        campaign: str(utmRaw.campaign, 120),
        content: str(utmRaw.content, 120),
        term: str(utmRaw.term, 120),
      },
    };
  }

  const promoCode =
    typeof b.promoCode === "string" && b.promoCode.trim()
      ? normalizePromoCode(b.promoCode)
      : undefined;

  return {
    region,
    customer: { name, email, phone },
    shipping: ship,
    notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 1000) : undefined,
    items: cleanItems,
    attribution,
    promoCode,
    offerExpected: b.offerExpected === true,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const isUs = parsed.region === "us";
  // US orders are paid up front by card once Stripe is set up; until then (and
  // for every Egypt order) nothing is charged at checkout.
  const payByCard = isUs && (await isCardCheckoutEnabled());

  // The discount is always recomputed here, from the code and the server-side
  // subtotal — the client never gets to hand over a discount amount.
  let promo: PromoCode | null = null;
  if (parsed.promoCode) {
    promo = await getPromoCodeByCode(parsed.promoCode);
    if (validatePromo(promo, parsed.region)) {
      return NextResponse.json(
        { error: `Promo code "${parsed.promoCode}" is no longer valid.` },
        { status: 400 }
      );
    }
  }

  // US orders are recorded for manual follow-up, not dispatched: Droppin is an
  // Egypt-only courier, so they carry no carrier fee and never auto-push.
  const zone = isUs
    ? "international"
    : resolveZone(parsed.shipping.country, parsed.shipping.state);
  const [fees, offerConfig] = await Promise.all([getShippingFees(), getOfferConfig()]);
  // The zone's normal fee; the spend offer may waive it below.
  const zoneFee = isUs ? 0 : feeForZone(zone, fees);
  // The server decides whether the offer applies, at the moment of ordering —
  // if it ended while the cart was open, the order is at normal prices.
  const offer = isOfferLive(offerConfig, parsed.region) ? offerConfig : null;

  // Every EGYPT order is dispatched to Droppin the moment it is placed — there
  // is no admin step.
  const autoPush = !isUs && zone !== "international";

  const SOCIAL_HOSTS: Record<string, string> = {
    "instagram.com": "instagram",
    "www.instagram.com": "instagram",
    "l.instagram.com": "instagram",
    "facebook.com": "facebook",
    "www.facebook.com": "facebook",
    "m.facebook.com": "facebook",
    "l.facebook.com": "facebook",
    "lm.facebook.com": "facebook",
    "tiktok.com": "tiktok",
    "www.tiktok.com": "tiktok",
    "vm.tiktok.com": "tiktok",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "t.co": "twitter",
  };
  let referrerHost: string | null = null;
  let socialReferrer: string | null = null;
  const refUrl = parsed.attribution?.referrer ?? null;
  if (refUrl) {
    try {
      const h = new URL(refUrl).hostname.toLowerCase();
      referrerHost = h;
      socialReferrer = SOCIAL_HOSTS[h] ?? null;
    } catch {
      // ignore
    }
  }

  const attributionDoc = parsed.attribution
    ? {
        sessionId: parsed.attribution.sessionId,
        referrer: parsed.attribution.referrer,
        referrerHost,
        socialReferrer,
        utm: parsed.attribution.utm,
      }
    : null;

  // Reserve stock and create the order in ONE transaction. Because the order is
  // dispatched to Droppin as soon as it exists, an order that can't be covered
  // by stock must never be created at all — so the check that used to be an
  // advisory read (which failed open) is now the authoritative write. Each store
  // sells only from its own stock, so this reads and deducts the pool of the
  // region the order was placed in. The same reads price every line.
  //
  // A card checkout is written to /checkouts instead, holding its stock until
  // Stripe confirms the payment and turns it into an order under the same id
  // (see lib/stripe-server.ts).
  const table = payByCard ? CHECKOUTS : "orders";
  const orderId = newId();
  let placed: {
    items: (IncomingItem & { price: number })[];
    totals: CheckoutTotals;
    coverByHandle: Map<string, string | undefined>;
  };
  try {
    placed = await sql.begin(async (tx) => {
      const reads = await readProductsForItems(tx, parsed.items, parsed.region);
      const items = priceItems(parsed.items, reads.productByHandle, parsed.region);
      const deductions = deductionsByProduct(items, reads.productByHandle);
      const shortfalls = findShortfalls(deductions, reads);
      if (shortfalls.length) throw new InsufficientStockError(shortfalls);
      const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
      // The offer and a code never stack: whichever saves more applies.
      const totals = checkoutTotals({
        subtotal,
        shippingFee: zoneFee,
        offer,
        promo: promo
          ? { code: promo.code, discount: computePromoDiscount(promo, subtotal, parsed.region) }
          : null,
      });
      // Recorded on the order so cancelling restores exactly what was taken.
      const stockDeducted = await writeDeductions(tx, deductions, reads);
      const order = {
        id: orderId,
        customer: parsed.customer,
        shipping: parsed.shipping,
        items,
        notes: parsed.notes ?? null,
        subtotal,
        discountAmount: totals.discountAmount,
        promoCode: totals.promoCode,
        shippingFee: totals.shippingFee,
        shippingZone: zone,
        droppinAutoPush: autoPush,
        region: parsed.region,
        currency: REGION_CURRENCY[parsed.region],
        status: payByCard ? "open" : "pending",
        attribution: attributionDoc,
        createdAt: new Date(),
        stockDeducted,
        // While the offer runs, every Egypt order records what it got from it,
        // so the admin can count offer orders and what they cost.
        ...(totals.offerTier !== null
          ? {
              offerTier: totals.offerTier,
              offerDiscount: totals.offerDiscount,
              deliveryFeeWaived: totals.deliveryFeeWaived,
            }
          : {}),
      };
      await tx`insert into ${tx(table)} ${tx(withJson(tx, order, ORDER_JSON_COLUMNS))}`;
      // Product photos for Stripe's payment page.
      const coverByHandle = new Map<string, string | undefined>();
      for (const [handle, p] of reads.productByHandle) {
        coverByHandle.set(handle, p.media?.find((m) => m.type === "image")?.src);
      }
      return { items, totals, coverByHandle };
    });
  } catch (err) {
    if (err instanceof UnpricedItemError) {
      return NextResponse.json(
        { error: `${err.title} is no longer available. Please remove it from your bag.` },
        { status: 409 }
      );
    }
    if (err instanceof InsufficientStockError) {
      const s = err.shortfalls[0];
      return NextResponse.json(
        {
          error:
            s.have <= 0
              ? `${s.title} (${s.size}) is sold out.`
              : `Only ${s.have} of ${s.title} (${s.size}) left.`,
        },
        { status: 409 }
      );
    }
    console.error("Order transaction failed:", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  const { items, totals } = placed;
  const { subtotal, discountAmount, shippingFee, total } = totals;
  // Everything the confirmation screen needs to show the same breakdown.
  const breakdown = {
    subtotal,
    discountAmount,
    offerDiscount: totals.offerDiscount,
    promoCode: totals.promoCode,
    shippingFee,
    deliveryFeeWaived: totals.deliveryFeeWaived,
    saved: totals.saved,
    total,
    outcome: totals.outcome,
    offerEnded: parsed.offerExpected && !offer,
  };

  // Card checkout: hand the shopper to Stripe. Emails wait until Stripe
  // confirms the payment; if the session can't even be opened, the stock goes
  // straight back rather than sitting on a checkout nobody can pay.
  if (payByCard) {
    try {
      const session = await createCheckoutSession({
        checkoutId: orderId,
        email: parsed.customer.email,
        items: items.map((i) => ({ ...i, image: placed.coverByHandle.get(i.productHandle) })),
        discountAmount,
        promoCode: totals.promoCode,
        origin: new URL(request.url).origin,
      });
      // The session carries the checkout id in its metadata, so fulfillment
      // doesn't depend on this write — it lets Cancel expire the session.
      await sql`update checkouts set stripe_session_id = ${session.id} where id = ${orderId}`.catch((err) =>
        console.error(`Could not record the Stripe session on checkout ${orderId}:`, err)
      );
      return NextResponse.json({ ok: true, orderId, total, checkoutUrl: session.url });
    } catch (err) {
      console.error(`Stripe session failed for checkout ${orderId}:`, err);
      await releaseCheckout(orderId, "session_failed").catch((releaseErr) =>
        console.error(`Could not release checkout ${orderId}:`, releaseErr)
      );
      return NextResponse.json(
        { error: "We couldn't start the payment. Please try again." },
        { status: 502 }
      );
    }
  }

  const emailPayload: OrderForEmail = {
    id: orderId,
    currency: REGION_CURRENCY[parsed.region],
    customerName: parsed.customer.name,
    customerEmail: parsed.customer.email,
    customerPhone: parsed.customer.phone,
    shipping: parsed.shipping,
    notes: parsed.notes,
    items,
    subtotal,
    discountAmount,
    promoCode: totals.promoCode ?? undefined,
    offerDiscount: totals.offerDiscount,
    shippingFee,
    deliveryFeeWaived: totals.deliveryFeeWaived,
    placedAt: placedAtLabel(),
  };

  // The carrier push runs alongside the confirmation emails so it costs the
  // shopper no extra wait. It is best-effort: a Droppin outage must never fail
  // a checkout that is already saved, and pushOrderToDroppin persists the error
  // onto the order so an admin can retry from the order page.
  const shouldPush = autoPush && isDroppinConfigured();
  if (autoPush && !shouldPush) {
    console.warn(`Droppin is not configured; order ${orderId} was not dispatched.`);
  }

  const [, pushResult] = await Promise.all([
    sendOrderPlacedEmails(emailPayload, parsed.region),
    // getOrderById runs outside pushOrderToDroppin's own try/catch, so guard
    // the whole call rather than trusting its return shape.
    shouldPush
      ? pushOrderToDroppin(orderId).catch((err) => ({
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        }))
      : Promise.resolve(null),
  ]);

  if (pushResult && !pushResult.ok) {
    console.error(`Droppin auto-push failed for order ${orderId}:`, pushResult.error);
  }

  return NextResponse.json({ ok: true, orderId, total, breakdown });
}
