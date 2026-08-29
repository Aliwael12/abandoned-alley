import { NextResponse } from "next/server";
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  sendEmail,
  EMAIL_FROM,
  ADMIN_EMAIL,
  customerOrderHtml,
  adminOrderHtml,
  type OrderForEmail,
} from "@/lib/email";
import { getShippingFees } from "@/lib/settings-server";
import {
  COUNTRY_EGYPT,
  feeForZone,
  isEgyptGovernorate,
  resolveZone,
} from "@/lib/shipping";
import {
  InsufficientStockError,
  deductionsByProduct,
  findShortfalls,
  readProductsForItems,
  writeDeductions,
} from "@/lib/stock-reservation";
import { isDroppinConfigured } from "@/lib/droppin";
import { pushOrderToDroppin } from "@/lib/orders-server";

export const runtime = "nodejs";

type IncomingItem = {
  productHandle: string;
  variantId: string;
  title: string;
  variantTitle: string;
  price: number;
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
  if (resolveZone(ship.country, ship.state) === "international") {
    return "We currently deliver within Egypt only.";
  }
  if (!isEgyptGovernorate(ship.state)) {
    return "Please select a valid Egyptian governorate.";
  }
  // The server is authoritative about the destination country.
  ship.country = COUNTRY_EGYPT;

  const items = b.items;
  if (!Array.isArray(items) || items.length === 0) return "Cart is empty";
  const cleanItems: IncomingItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return "Invalid item";
    const it = raw as Record<string, unknown>;
    const qty = Number(it.quantity);
    const price = Number(it.price);
    if (!Number.isFinite(qty) || qty <= 0) return "Invalid quantity";
    if (!Number.isFinite(price) || price < 0) return "Invalid price";
    cleanItems.push({
      productHandle: String(it.productHandle ?? ""),
      variantId: String(it.variantId ?? ""),
      title: String(it.title ?? ""),
      variantTitle: String(it.variantTitle ?? ""),
      price,
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

  return {
    customer: { name, email, phone },
    shipping: ship,
    notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 1000) : undefined,
    items: cleanItems,
    attribution,
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

  const subtotal = parsed.items.reduce((n, i) => n + i.price * i.quantity, 0);
  const zone = resolveZone(parsed.shipping.country, parsed.shipping.state);
  const fees = await getShippingFees();
  const shippingFee = feeForZone(zone, fees);

  // Every Egypt order is dispatched to Droppin automatically the moment it is
  // placed — there is no admin step. International orders are rejected above;
  // the zone guard keeps the rule explicit if the US store ever opens.
  const autoPush = zone !== "international";

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

  const orderDoc = {
    customer: parsed.customer,
    shipping: parsed.shipping,
    items: parsed.items,
    notes: parsed.notes ?? null,
    subtotal,
    shippingFee,
    shippingZone: zone,
    droppinAutoPush: autoPush,
    currency: "EGP",
    status: "pending",
    attribution: attributionDoc,
    createdAt: serverTimestamp(),
  };

  // Reserve stock and create the order in ONE transaction. Because the order is
  // dispatched to Droppin as soon as it exists, an order that can't be covered
  // by stock must never be created at all — so the check that used to be an
  // advisory read (which failed open) is now the authoritative write.
  const orderRef = doc(collection(db, "orders"));
  const orderId = orderRef.id;
  try {
    await runTransaction(db, async (tx) => {
      const reads = await readProductsForItems(tx, parsed.items);
      const deductions = deductionsByProduct(parsed.items, reads.productByHandle);
      const shortfalls = findShortfalls(deductions, reads);
      if (shortfalls.length) throw new InsufficientStockError(shortfalls);
      // Recorded on the order so cancelling restores exactly what was taken.
      const stockDeducted = writeDeductions(tx, deductions, reads);
      tx.set(orderRef, { ...orderDoc, stockDeducted });
    });
  } catch (err) {
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

  const emailPayload: OrderForEmail = {
    id: orderId,
    customerName: parsed.customer.name,
    customerEmail: parsed.customer.email,
    customerPhone: parsed.customer.phone,
    shipping: parsed.shipping,
    notes: parsed.notes,
    items: parsed.items,
    subtotal,
    shippingFee,
    placedAt: new Date().toLocaleString("en-GB", {
      timeZone: "Africa/Cairo",
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };

  // The carrier push runs alongside the confirmation emails so it costs the
  // shopper no extra wait. It is best-effort: a Droppin outage must never fail
  // a checkout that is already saved, and pushOrderToDroppin persists the error
  // onto the order so an admin can retry from the order page.
  const shouldPush = autoPush && isDroppinConfigured();
  if (autoPush && !shouldPush) {
    console.warn(`Droppin is not configured; order ${orderId} was not dispatched.`);
  }

  const [emailResults, pushResult] = await Promise.all([
    Promise.allSettled([
      sendEmail({
        from: EMAIL_FROM,
        to: parsed.customer.email,
        subject: `Order confirmation #${orderId}`,
        html: customerOrderHtml(emailPayload),
        replyTo: ADMIN_EMAIL,
      }),
      sendEmail({
        from: EMAIL_FROM,
        to: ADMIN_EMAIL,
        subject: `New order — ${parsed.customer.name} (${parsed.shipping.state}) — EGP ${(
          subtotal + shippingFee
        ).toFixed(2)}`,
        html: adminOrderHtml(emailPayload),
        replyTo: parsed.customer.email,
      }),
    ]),
    // getOrderById runs outside pushOrderToDroppin's own try/catch, so guard
    // the whole call rather than trusting its return shape.
    shouldPush
      ? pushOrderToDroppin(orderId).catch((err) => ({
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        }))
      : Promise.resolve(null),
  ]);

  const emailErrors = emailResults
    .map((r, i) =>
      r.status === "rejected"
        ? { recipient: i === 0 ? "customer" : "admin", reason: String(r.reason) }
        : null
    )
    .filter(Boolean);
  if (emailErrors.length) {
    console.error(`Order ${orderId} email failures:`, emailErrors);
  }

  if (pushResult && !pushResult.ok) {
    console.error(`Droppin auto-push failed for order ${orderId}:`, pushResult.error);
  }

  return NextResponse.json({ ok: true, orderId });
}
