import { NextResponse } from "next/server";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  resend,
  EMAIL_FROM,
  ADMIN_EMAIL,
  customerOrderHtml,
  adminOrderHtml,
  type OrderForEmail,
} from "@/lib/email";
import { getShippingFees } from "@/lib/settings-server";
import { getAllProducts } from "@/lib/products-server";
import { sizeOfOrderItem, stockForSize } from "@/lib/inventory";
import {
  COUNTRY_EGYPT,
  feeForZone,
  isEgyptGovernorate,
  resolveZone,
} from "@/lib/shipping";

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

  // Stock guard: reject the order if any line exceeds the available per-size
  // stock. This is the authoritative check — the storefront UI also caps qty,
  // but a client could bypass it. Aggregate per product+size first so multiple
  // lines of the same variant are summed.
  try {
    const products = await getAllProducts();
    const byHandle = new Map(products.map((p) => [p.handle, p]));
    const wanted = new Map<string, number>(); // `${handle}::${size}` -> qty
    const keyOf = (h: string, s: string) => `${h}::${s}`;
    for (const it of parsed.items) {
      const product = byHandle.get(it.productHandle);
      const size = sizeOfOrderItem(it, product);
      if (!size) continue;
      const k = keyOf(it.productHandle, size);
      wanted.set(k, (wanted.get(k) ?? 0) + it.quantity);
    }
    for (const [k, qty] of wanted) {
      const [handle, size] = k.split("::");
      const product = byHandle.get(handle);
      const have = stockForSize(product?.stock, size);
      if (have < qty) {
        const name = product?.title ?? handle;
        return NextResponse.json(
          {
            error:
              have <= 0
                ? `${name} (${size}) is sold out.`
                : `Only ${have} of ${name} (${size}) left.`,
          },
          { status: 409 }
        );
      }
    }
  } catch (err) {
    console.error("Stock check failed:", err);
    // Fail open rather than block checkout on a transient read error; approval
    // will still catch any genuine shortfall.
  }

  const subtotal = parsed.items.reduce((n, i) => n + i.price * i.quantity, 0);
  const zone = resolveZone(parsed.shipping.country, parsed.shipping.state);
  const fees = await getShippingFees();
  const shippingFee = feeForZone(zone, fees);

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
    droppinAutoPush: zone === "metro",
    currency: "EGP",
    status: "pending",
    attribution: attributionDoc,
    createdAt: serverTimestamp(),
  };

  let orderId: string;
  try {
    const ref = await addDoc(collection(db, "orders"), orderDoc);
    orderId = ref.id;
  } catch (err) {
    console.error("Firestore error:", err);
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
  };

  const results = await Promise.allSettled([
    resend.emails.send({
      from: EMAIL_FROM,
      to: parsed.customer.email,
      subject: `Order confirmation #${orderId}`,
      html: customerOrderHtml(emailPayload),
      replyTo: ADMIN_EMAIL,
    }),
    resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `New order #${orderId} — EGP ${(subtotal + shippingFee).toFixed(2)}`,
      html: adminOrderHtml(emailPayload),
      replyTo: parsed.customer.email,
    }),
  ]);

  const emailErrors = results
    .map((r, i) => (r.status === "rejected" ? { idx: i, reason: r.reason } : null))
    .filter(Boolean);
  if (emailErrors.length) {
    console.error("Resend errors:", emailErrors);
  }

  // Orders are NOT dispatched at checkout anymore. They wait as "pending" until
  // an admin approves them, which deducts stock and dispatches to the carrier
  // (Cairo / Giza -> Droppin). See src/lib/order-actions-server.ts.

  return NextResponse.json({ ok: true, orderId });
}
