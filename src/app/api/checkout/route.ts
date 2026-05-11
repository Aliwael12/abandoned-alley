import { NextResponse } from "next/server";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  resend,
  EMAIL_FROM,
  ADMIN_EMAIL,
  customerOrderHtml,
  adminOrderHtml,
  type OrderForEmail,
} from "@/lib/email";
import {
  buildPackageFromOrder,
  isDroppinConfigured,
  pushPackages,
} from "@/lib/droppin";
import { getShippingFee } from "@/lib/settings-server";

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
  for (const [k, v] of Object.entries(ship)) {
    if (!v) return `Shipping ${k} required`;
  }

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
  const shippingFee = await getShippingFee();

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

  if (isDroppinConfigured()) {
    try {
      const pkg = buildPackageFromOrder({
        id: orderId,
        customer: parsed.customer,
        shipping: parsed.shipping,
        items: parsed.items,
        subtotal,
        shippingFee,
        notes: parsed.notes ?? null,
      });
      const result = await pushPackages([pkg]);
      const created = result.createdPackages?.[0];
      if (result.success && created) {
        await updateDoc(doc(db, "orders", orderId), {
          droppinPackageId: created.id,
          droppinTrackingNumber: created.trackingNumber,
          droppinStatus: created.status,
          droppinPushedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "orders", orderId), {
          droppinError: result.error || "Unknown push failure",
          droppinPushAttemptedAt: serverTimestamp(),
        });
        console.error("Droppin push failed:", result.error);
      }
    } catch (err) {
      console.error("Droppin push error:", err);
      try {
        await updateDoc(doc(db, "orders", orderId), {
          droppinError: err instanceof Error ? err.message : String(err),
          droppinPushAttemptedAt: serverTimestamp(),
        });
      } catch {
        // best-effort
      }
    }
  }

  return NextResponse.json({ ok: true, orderId });
}
