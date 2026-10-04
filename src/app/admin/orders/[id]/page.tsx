import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PushToDroppinButton from "./PushToDroppinButton";
import { REGION_LABEL } from "@/lib/pricing";
import OrderActions from "./OrderActions";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrderById } from "@/lib/orders-server";
import { getAllProducts } from "@/lib/products-server";
import {
  CARRIER_LABEL,
  displayStatusLabel,
  normalizeStatus,
} from "@/lib/order-status";
import type { Product } from "@/lib/products";
import {
  getCardPaymentSummary,
  isStripeConfigured,
  type CardPaymentSummary,
} from "@/lib/stripe-server";

export const metadata = { title: "Order — Abandoned Alley Admin" };
export const dynamic = "force-dynamic";

const fmt = (n: number, currency: string) =>
  n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 2 });

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const allProducts = await getAllProducts();
  const productMap = new Map<string, Product>(allProducts.map((p) => [p.handle, p]));

  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const status = normalizeStatus(order.status);
  const paidByCard = order.payment.method === "card";

  // Ask Stripe, not the order document: the open Firestore rules let anyone
  // write a "paid" flag, but only a real payment shows up in Stripe.
  let stripePayment: CardPaymentSummary | null = null;
  let stripeError: string | null = null;
  if (paidByCard) {
    if (!order.payment.stripePaymentIntentId) {
      stripeError = "This order has no Stripe payment on record.";
    } else if (!isStripeConfigured()) {
      stripeError = "Stripe isn't configured on this deployment, so the payment can't be checked.";
    } else {
      try {
        stripePayment = await getCardPaymentSummary(order.payment.stripePaymentIntentId);
      } catch (err) {
        stripeError = `Couldn't reach Stripe: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  const paymentVerified = stripePayment?.status === "succeeded";

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-12 flex flex-col gap-8">
      <Link
        href="/admin?tab=orders"
        className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition self-start"
      >
        <ArrowLeft size={14} />
        Back to orders
      </Link>

      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.4em] uppercase text-[var(--text-muted)]">Order</p>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-5xl tracking-[0.12em] uppercase">
            #{order.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-1">{order.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 text-[11px] tracking-[0.2em] uppercase border border-[var(--border-default)] rounded">
            {displayStatusLabel(order.status)}
          </span>
          <span className="px-3 py-1 text-[11px] tracking-[0.2em] uppercase border border-[var(--border-default)] rounded">
            {REGION_LABEL[order.region]}
          </span>
          <span className="px-3 py-1 text-[11px] tracking-[0.2em] uppercase border border-[var(--border-default)] rounded text-[var(--text-muted)]">
            {order.region === "us"
              ? order.shipping.state || "—"
              : `${CARRIER_LABEL.droppin} · ${order.shipping.state || "—"}`}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}
          </span>
        </div>
      </header>

      <section className="glass  p-6 flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Order actions
        </h2>
        <OrderActions orderId={order.id} status={status} paidByCard={paidByCard} />
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="glass  p-6 flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Customer
          </h2>
          <p className="text-sm text-[var(--text-primary)]">{order.customer.name || "—"}</p>
          {order.customer.email && (
            <a
              href={`mailto:${order.customer.email}`}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition break-all"
            >
              {order.customer.email}
            </a>
          )}
          {order.customer.phone && (
            <a
              href={`tel:${order.customer.phone}`}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              {order.customer.phone}
            </a>
          )}
        </section>

        <section className="glass  p-6 flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Shipping
          </h2>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {order.shipping.address}
            <br />
            {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
            <br />
            {order.shipping.country}
          </p>
        </section>
      </div>

      <section className="glass  p-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em] mb-4">
          Items ({itemCount})
        </h2>
        {/* Mobile: stacked item cards */}
        <ul className="md:hidden flex flex-col gap-3">
          {order.items.map((it) => {
            const p = productMap.get(it.productHandle);
            const img = p?.media.find((m) => m.type === "image");
            return (
              <li
                key={it.variantId}
                className="flex gap-3 border-b border-[var(--border-subtle)] pb-3 last:border-b-0 last:pb-0"
              >
                <div className="relative w-14 h-14 bg-[var(--surface-card-alt)] rounded overflow-hidden shrink-0">
                  {img && img.type === "image" && (
                    <Image
                      src={img.src}
                      alt={it.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-sm text-[var(--text-primary)]">{it.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{it.variantTitle}</p>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-1">
                    <span>
                      {it.quantity} × {fmt(it.price, order.currency)}
                    </span>
                    <span className="text-[var(--text-primary)]">
                      {fmt(it.price * it.quantity, order.currency)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {/* Desktop: items table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-2 pr-4">Product</th>
                <th className="text-left py-2 pr-4">Variant</th>
                <th className="text-right py-2 pr-4">Qty</th>
                <th className="text-right py-2 pr-4">Price</th>
                <th className="text-right py-2">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => {
                const p = productMap.get(it.productHandle);
                const img = p?.media.find((m) => m.type === "image");
                return (
                  <tr key={it.variantId} className="border-b border-[var(--border-subtle)] align-top">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 bg-[var(--surface-card-alt)] rounded overflow-hidden shrink-0">
                          {img && img.type === "image" && (
                            <Image
                              src={img.src}
                              alt={it.title}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[var(--text-primary)]">{it.title}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono">
                            /{it.productHandle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-muted)]">{it.variantTitle}</td>
                    <td className="py-3 pr-4 text-right">{it.quantity}</td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(it.price, order.currency)}
                    </td>
                    <td className="py-3 text-right">
                      {fmt(it.price * it.quantity, order.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass  p-6 flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            {order.region === "us" ? "Shipping (US)" : "Shipping (Droppin)"}
          </h2>
          {order.region === "us" ? (
            /* Droppin only serves Egypt, so US orders are recorded here for
               manual follow-up rather than dispatched to any carrier. */
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                  Destination
                </span>
                <span className="text-[var(--text-primary)]">
                  {[order.shipping.state, order.shipping.zip].filter(Boolean).join(" ") || "—"}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                {paidByCard
                  ? "US order — paid by card, shipped manually."
                  : "US order — payment and delivery arranged manually."}{" "}
                It is not sent to Droppin, which only serves Egypt.
              </p>
            </>
          ) : order.droppin.trackingNumber ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                  Tracking
                </span>
                <a
                  href={`https://api.droppin-eg.com/api/packages/track/${order.droppin.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[var(--text-primary)] hover:text-[var(--text-primary)] transition"
                >
                  {order.droppin.trackingNumber}
                </a>
              </div>
              {order.droppin.status && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                    Status
                  </span>
                  <span>{order.droppin.status}</span>
                </div>
              )}
              {order.droppin.packageId !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                    Package ID
                  </span>
                  <span className="font-mono text-[var(--text-muted)]">
                    {order.droppin.packageId}
                  </span>
                </div>
              )}
              {order.droppin.pushedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                    Pushed
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {new Date(order.droppin.pushedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                  Destination
                </span>
                <span className="text-[var(--text-primary)]">
                  {order.shipping.state || "—"}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                Orders dispatch to Droppin automatically when you approve them.
                Use the button below to push or retry manually.
              </p>
              {order.droppin.error && (
                <p className="text-sm text-red-300/90">
                  Last attempt failed: {order.droppin.error}
                </p>
              )}
              <PushToDroppinButton orderId={order.id} />
            </>
          )}
        </section>

      <section className="glass  p-6 flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Payment
        </h2>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Method</span>
          <span>
            {paidByCard
              ? "Card (Stripe)"
              : order.region === "us"
              ? "Arranged manually"
              : "Cash on delivery"}
          </span>
        </div>
        {paidByCard && stripePayment && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
                Stripe status
              </span>
              <span className={paymentVerified ? "text-[var(--success-default)]" : "text-[var(--warning-default)]"}>
                {paymentVerified ? "Paid — verified with Stripe" : stripePayment.status}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Received</span>
              <span>{fmt(stripePayment.amountReceived, stripePayment.currency)}</span>
            </div>
            {stripePayment.amountRefunded > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Refunded</span>
                <span>-{fmt(stripePayment.amountRefunded, stripePayment.currency)}</span>
              </div>
            )}
            <a
              href={stripePayment.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition self-start"
            >
              Open in Stripe ↗
            </a>
          </>
        )}
        {paidByCard && stripeError && (
          <p className="text-sm text-[var(--warning-default)]/90">
            {stripeError} Don&apos;t ship until you&apos;ve confirmed the payment in the Stripe dashboard.
          </p>
        )}
        {paidByCard && stripePayment && !paymentVerified && (
          <p className="text-sm text-[var(--warning-default)]/90">
            Stripe doesn&apos;t show this payment as completed. Don&apos;t ship until it does.
          </p>
        )}
      </section>

      <section className="glass  p-6 flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Summary
        </h2>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Subtotal</span>
          <span>{fmt(order.subtotal, order.currency)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">
              {order.offer && order.offer.discount > 0
                ? "Spend offer discount"
                : `Discount${order.promoCode ? ` (${order.promoCode})` : ""}`}
            </span>
            <span>-{fmt(order.discountAmount, order.currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Shipping</span>
          <span>
            {order.offer && order.offer.deliveryFeeWaived > 0 && (
              <span className="line-through text-[var(--text-muted)] mr-2">
                {fmt(order.offer.deliveryFeeWaived + order.shippingFee, order.currency)}
              </span>
            )}
            {fmt(order.shippingFee, order.currency)}
          </span>
        </div>
        {order.offer && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Spend offer</span>
            <span>
              {order.offer.tier === "discount"
                ? `Discount + free delivery (cost ${fmt(order.offer.discount + order.offer.deliveryFeeWaived, order.currency)})`
                : order.offer.tier === "free_delivery"
                ? `Free delivery (cost ${fmt(order.offer.deliveryFeeWaived, order.currency)})`
                : "Not reached"}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-[var(--border-subtle)]">
          <span className="font-[family-name:var(--font-bebas)] tracking-[0.2em] text-base">
            Total
          </span>
          <span className="font-[family-name:var(--font-bebas)] tracking-[0.1em] text-base">
            {fmt(order.subtotal - order.discountAmount + order.shippingFee, order.currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Items</span>
          <span>{itemCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)] uppercase tracking-[0.2em] text-xs">Currency</span>
          <span>{order.currency}</span>
        </div>
        {order.notes && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--text-muted)] mb-2">
              Notes
            </p>
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </section>
    </div>
  );
}
