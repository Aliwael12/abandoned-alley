import { Resend } from "resend";
import type { Region } from "@/lib/pricing";
import { OFFER_COPY } from "@/lib/offer";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Abandoned Alley <onboarding@resend.dev>";
/**
 * Where order notifications go. ADMIN_EMAIL accepts a comma- (or semicolon-)
 * separated list, so the shop can notify several inboxes:
 *   ADMIN_EMAIL=a@gmail.com,b@outlook.com
 * Resend takes up to 50 recipients per send.
 */
export const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAIL ?? "abandonedalleystore@gmail.com"
)
  .split(/[,;]/)
  .map((s) => s.trim())
  .filter(Boolean);

/** The primary admin address — used where exactly one is needed (Reply-To). */
export const ADMIN_EMAIL = ADMIN_EMAILS[0] ?? "abandonedalleystore@gmail.com";

/**
 * Send one email, turning Resend's error envelope into a thrown error.
 *
 * `resend.emails.send()` RESOLVES with `{ data: null, error }` for API-level
 * failures — an unverified sender domain, a bad key, a quota trip. Callers that
 * only watch for rejections (Promise.allSettled, try/catch) therefore treat
 * those as successes and swallow them silently, which is how a stale sender
 * domain can stop every order email without leaving a trace in the logs.
 */
export async function sendEmail(
  payload: Parameters<typeof resend.emails.send>[0]
): Promise<{ id: string } | null> {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    throw new Error(
      `Resend ${error.name}${
        error.statusCode ? ` (${error.statusCode})` : ""
      }: ${error.message}`
    );
  }
  return data;
}

export type OrderItemForEmail = {
  title: string;
  variantTitle: string;
  quantity: number;
  price: number;
};

export type OrderForEmail = {
  id: string;
  /** Stored order currency ("EGP" | "USD"); defaults to EGP for legacy orders. */
  currency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shipping: {
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  notes?: string;
  items: OrderItemForEmail[];
  subtotal: number;
  discountAmount?: number;
  promoCode?: string;
  /** The spend offer's share of discountAmount (Egypt, while it runs). */
  offerDiscount?: number;
  /** What the customer pays for delivery. */
  shippingFee: number;
  /** Delivery fee the spend offer waived; the zone's normal fee is
   * shippingFee + deliveryFeeWaived. */
  deliveryFeeWaived?: number;
  /** ISO-ish display string for when the order was placed. */
  placedAt?: string;
  /** True when the customer already paid online (US card checkout). */
  paid?: boolean;
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Money in the order's own currency — US orders are booked in USD. */
const money = (amount: number, currency?: string) =>
  currency === "USD" ? `$${amount.toFixed(2)}` : `EGP ${amount.toFixed(2)}`;

const itemsHtml = (items: OrderItemForEmail[], currency?: string) =>
  items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #222;color:#eee;">
          <strong>${escape(i.title)}</strong><br/>
          <span style="color:#888;font-size:13px;">${escape(i.variantTitle)} &middot; Qty ${i.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #222;color:#eee;text-align:right;">
          ${money(i.price * i.quantity, currency)}
        </td>
      </tr>`
    )
    .join("");

const discountRowHtml = (
  discountAmount: number,
  promoCode: string | undefined,
  currency: string | undefined,
  offerDiscount = 0
) =>
  discountAmount > 0
    ? `
      <tr>
        <td style="padding:6px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">
          ${offerDiscount > 0 ? escape(OFFER_COPY.discountLabel(offerDiscount)) : `Discount${promoCode ? ` (${escape(promoCode)})` : ""}`}
        </td>
        <td style="padding:6px 0 0;color:#eee;text-align:right;font-size:14px;">-${money(discountAmount, currency)}</td>
      </tr>`
    : "";

/** Delivery line: crossed-out normal fee next to "Free" when the offer waived it. */
const shippingRowHtml = (order: OrderForEmail) => {
  const waived = order.deliveryFeeWaived ?? 0;
  const value =
    waived > 0
      ? `<span style="color:#666;text-decoration:line-through;">${money(waived + order.shippingFee, order.currency)}</span> ${escape(OFFER_COPY.freeDelivery)}`
      : money(order.shippingFee, order.currency);
  return `
      <tr>
        <td style="padding:6px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Shipping</td>
        <td style="padding:6px 0 0;color:#eee;text-align:right;font-size:14px;">${value}</td>
      </tr>`;
};

/** "You saved …" under the total at the offer's top tier, as the cart shows it. */
const savedRowHtml = (order: OrderForEmail) => {
  const waived = order.deliveryFeeWaived ?? 0;
  const offerDiscount = order.offerDiscount ?? 0;
  if (offerDiscount <= 0) return "";
  return `
      <tr>
        <td colspan="2" style="padding:10px 0 0;color:#f5d90a;text-align:right;font-size:13px;letter-spacing:0.08em;">
          ${escape(OFFER_COPY.saved(Math.round(waived + offerDiscount)))}
        </td>
      </tr>`;
};

export function customerOrderHtml(order: OrderForEmail) {
  const ship = order.shipping;
  const discountAmount = order.discountAmount ?? 0;
  const total = order.subtotal - discountAmount + order.shippingFee;
  return `
  <div style="background:#0a0a0a;color:#eee;font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:600px;margin:auto;">
    <h1 style="font-family:Impact,sans-serif;letter-spacing:0.18em;font-size:28px;margin:0 0 8px;">ABANDONED ALLEY</h1>
    <p style="color:#888;margin:0 0 24px;">Order confirmation &middot; #${escape(order.id)}</p>
    <p style="color:#eee;">Hey ${escape(order.customerName.split(" ")[0])}, ${
      order.paid
        ? "we got your order and your payment. We'll email you again when it ships."
        : "we got your order. We'll reach out shortly with payment details and shipping confirmation."
    }</p>
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      ${itemsHtml(order.items, order.currency)}
      <tr>
        <td style="padding:14px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Subtotal</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:14px;">${money(order.subtotal, order.currency)}</td>
      </tr>
      ${discountRowHtml(discountAmount, order.promoCode, order.currency, order.offerDiscount)}
      ${shippingRowHtml(order)}
      <tr>
        <td style="padding:14px 0 0;color:#eee;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;font-weight:bold;border-top:1px solid #222;">Total</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:18px;font-weight:bold;border-top:1px solid #222;">${money(total, order.currency)}</td>
      </tr>
      ${savedRowHtml(order)}
    </table>
    <h3 style="margin-top:32px;color:#eee;letter-spacing:0.1em;">Ship to</h3>
    <p style="color:#aaa;line-height:1.6;margin:0;">
      ${escape(order.customerName)}<br/>
      ${escape(ship.address)}<br/>
      ${escape(ship.city)}, ${escape(ship.state)} ${escape(ship.zip)}<br/>
      ${escape(ship.country)}
    </p>
    <p style="margin-top:32px;color:#666;font-size:12px;">Questions? Reply to this email.</p>
  </div>`;
}

export function adminOrderHtml(order: OrderForEmail) {
  const ship = order.shipping;
  const discountAmount = order.discountAmount ?? 0;
  const total = order.subtotal - discountAmount + order.shippingFee;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const metaRow = (label: string, value: string) => `
      <tr>
        <td style="padding:4px 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:11px;vertical-align:top;">${label}</td>
        <td style="padding:4px 0 4px 16px;color:#eee;font-size:13px;text-align:right;">${value}</td>
      </tr>`;
  return `
  <div style="background:#0a0a0a;color:#eee;font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:600px;margin:auto;">
    <h2 style="margin:0 0 16px;">New order #${escape(order.id)}</h2>
    <p style="margin:0;color:#aaa;">
      <strong>${escape(order.customerName)}</strong><br/>
      ${escape(order.customerEmail)} &middot; ${escape(order.customerPhone)}
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      ${order.placedAt ? metaRow("Placed", escape(order.placedAt)) : ""}
      ${metaRow("Items", String(itemCount))}
      ${order.paid ? metaRow("Payment", "Paid by card (Stripe)") : ""}
      ${metaRow("Governorate", escape(ship.state || "—"))}
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      ${itemsHtml(order.items, order.currency)}
      <tr>
        <td style="padding:14px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Subtotal</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:14px;">${money(order.subtotal, order.currency)}</td>
      </tr>
      ${discountRowHtml(discountAmount, order.promoCode, order.currency, order.offerDiscount)}
      ${shippingRowHtml(order)}
      <tr>
        <td style="padding:14px 0 0;color:#eee;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;font-weight:bold;border-top:1px solid #222;">Total</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:18px;font-weight:bold;border-top:1px solid #222;">${money(total, order.currency)}</td>
      </tr>
      ${savedRowHtml(order)}
    </table>
    <h3 style="margin-top:32px;">Ship to</h3>
    <p style="color:#aaa;line-height:1.6;margin:0;">
      ${escape(ship.address)}<br/>
      ${escape(ship.city)}, ${escape(ship.state)} ${escape(ship.zip)}<br/>
      ${escape(ship.country)}
    </p>
    ${order.notes ? `<h3 style="margin-top:24px;">Notes</h3><p style="color:#aaa;">${escape(order.notes)}</p>` : ""}
  </div>`;
}

/** When an order was placed, as the admin inbox reads it (Cairo time). */
export function placedAtLabel(date: Date = new Date()): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * The customer's confirmation and the admin notification for a newly placed
 * order. Never throws: the order is already saved by the time this runs, so a
 * failed send is logged for follow-up rather than failing the checkout.
 */
export async function sendOrderPlacedEmails(
  order: OrderForEmail,
  region: Region
): Promise<void> {
  const total =
    order.subtotal - (order.discountAmount ?? 0) + order.shippingFee;
  const results = await Promise.allSettled([
    sendEmail({
      from: EMAIL_FROM,
      to: order.customerEmail,
      subject: `Order confirmation #${order.id}`,
      html: customerOrderHtml(order),
      replyTo: ADMIN_EMAIL,
    }),
    sendEmail({
      from: EMAIL_FROM,
      to: ADMIN_EMAILS,
      subject: `New order (${region.toUpperCase()})${order.paid ? " · PAID" : ""} — ${
        order.customerName
      } (${order.shipping.state}) — ${money(total, order.currency)}`,
      html: adminOrderHtml(order),
      replyTo: order.customerEmail,
    }),
  ]);
  const failures = results
    .map((r, i) =>
      r.status === "rejected"
        ? { recipient: i === 0 ? "customer" : "admin", reason: String(r.reason) }
        : null
    )
    .filter(Boolean);
  if (failures.length) {
    console.error(`Order ${order.id} email failures:`, failures);
  }
}
