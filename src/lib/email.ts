import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Abandoned Alley <onboarding@resend.dev>";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "abandonedalleystore@gmail.com";

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
  shippingFee: number;
  /** ISO-ish display string for when the order was placed. */
  placedAt?: string;
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const itemsHtml = (items: OrderItemForEmail[]) =>
  items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #222;color:#eee;">
          <strong>${escape(i.title)}</strong><br/>
          <span style="color:#888;font-size:13px;">${escape(i.variantTitle)} &middot; Qty ${i.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #222;color:#eee;text-align:right;">
          EGP ${(i.price * i.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

export function customerOrderHtml(order: OrderForEmail) {
  const ship = order.shipping;
  const total = order.subtotal + order.shippingFee;
  return `
  <div style="background:#0a0a0a;color:#eee;font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:600px;margin:auto;">
    <h1 style="font-family:Impact,sans-serif;letter-spacing:0.18em;font-size:28px;margin:0 0 8px;">ABANDONED ALLEY</h1>
    <p style="color:#888;margin:0 0 24px;">Order confirmation &middot; #${escape(order.id)}</p>
    <p style="color:#eee;">Hey ${escape(order.customerName.split(" ")[0])}, we got your order. We'll reach out shortly with payment details and shipping confirmation.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      ${itemsHtml(order.items)}
      <tr>
        <td style="padding:14px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Subtotal</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:14px;">EGP ${order.subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Shipping</td>
        <td style="padding:6px 0 0;color:#eee;text-align:right;font-size:14px;">EGP ${order.shippingFee.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;color:#eee;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;font-weight:bold;border-top:1px solid #222;">Total</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:18px;font-weight:bold;border-top:1px solid #222;">EGP ${total.toFixed(2)}</td>
      </tr>
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
  const total = order.subtotal + order.shippingFee;
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
      ${metaRow("Governorate", escape(ship.state || "—"))}
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:24px;">
      ${itemsHtml(order.items)}
      <tr>
        <td style="padding:14px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Subtotal</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:14px;">EGP ${order.subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0 0;color:#888;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;">Shipping</td>
        <td style="padding:6px 0 0;color:#eee;text-align:right;font-size:14px;">EGP ${order.shippingFee.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;color:#eee;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;font-weight:bold;border-top:1px solid #222;">Total</td>
        <td style="padding:14px 0 0;color:#eee;text-align:right;font-size:18px;font-weight:bold;border-top:1px solid #222;">EGP ${total.toFixed(2)}</td>
      </tr>
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
