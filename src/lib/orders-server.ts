import { sql, toMillis as tsToMillis } from "@/lib/db";
import {
  buildPackageFromOrder,
  isDroppinConfigured,
  pushPackages,
} from "@/lib/droppin";
import type { ShippingZone } from "@/lib/shipping";
import { toRegion, type Region } from "@/lib/pricing";
import type { OfferTier } from "@/lib/offer";

export type OrderItem = {
  productHandle: string;
  variantId: string;
  title: string;
  variantTitle: string;
  price: number;
  quantity: number;
};

export type OrderShipping = {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type OrderDetail = {
  id: string;
  customer: { name: string; email: string; phone: string };
  shipping: OrderShipping;
  items: OrderItem[];
  notes: string | null;
  subtotal: number;
  discountAmount: number;
  promoCode: string | null;
  shippingFee: number;
  currency: string;
  status: string;
  shippingZone: ShippingZone;
  /** Which storefront the order came from. US orders are never dispatched. */
  region: Region;
  droppinAutoPush: boolean;
  createdAt: number | null;
  droppin: {
    packageId: number | null;
    trackingNumber: string | null;
    status: string | null;
    error: string | null;
    pushedAt: number | null;
  };
  /** How the customer paid. `card` orders were paid up front through Stripe
   * Checkout; anything else is settled on delivery or arranged manually. The
   * stored flags are only a pointer — open Firestore rules make them
   * forgeable, so the admin page confirms them against Stripe. */
  payment: {
    method: "card" | null;
    stripePaymentIntentId: string | null;
    amountPaid: number | null;
    stripeRefundId: string | null;
  };
  /** What the Egypt spend offer gave this order; null when it wasn't running. */
  offer: {
    tier: OfferTier;
    discount: number;
    deliveryFeeWaived: number;
  } | null;
};

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const [data] = await sql`select * from orders where id = ${id}`;
  if (!data) return null;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const shipping = (data.shipping ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items) ? (data.items as OrderItem[]) : [];

  return {
    id: String(data.id),
    customer: {
      name: String(customer.name ?? ""),
      email: String(customer.email ?? ""),
      phone: String(customer.phone ?? ""),
    },
    shipping: {
      address: String(shipping.address ?? ""),
      city: String(shipping.city ?? ""),
      state: String(shipping.state ?? ""),
      zip: String(shipping.zip ?? ""),
      country: String(shipping.country ?? ""),
    },
    items: items.map((i) => ({
      productHandle: String(i.productHandle ?? ""),
      variantId: String(i.variantId ?? ""),
      title: String(i.title ?? ""),
      variantTitle: String(i.variantTitle ?? ""),
      price: Number(i.price ?? 0),
      quantity: Number(i.quantity ?? 0),
    })),
    notes: typeof data.notes === "string" ? (data.notes as string) : null,
    subtotal: Number(data.subtotal ?? 0),
    discountAmount: Number(data.discountAmount ?? 0),
    promoCode: typeof data.promoCode === "string" ? (data.promoCode as string) : null,
    shippingFee: Number(data.shippingFee ?? 0),
    currency: String(data.currency ?? "EGP"),
    status: String(data.status ?? "pending"),
    shippingZone:
      data.shippingZone === "egypt" ||
      data.shippingZone === "international" ||
      data.shippingZone === "metro"
        ? (data.shippingZone as ShippingZone)
        : "metro",
    region: toRegion(data.region),
    droppinAutoPush:
      typeof data.droppinAutoPush === "boolean" ? data.droppinAutoPush : true,
    createdAt: tsToMillis(data.createdAt),
    droppin: {
      packageId:
        typeof data.droppinPackageId === "number" ? data.droppinPackageId : null,
      trackingNumber:
        typeof data.droppinTrackingNumber === "string"
          ? data.droppinTrackingNumber
          : null,
      status: typeof data.droppinStatus === "string" ? data.droppinStatus : null,
      error: typeof data.droppinError === "string" ? data.droppinError : null,
      pushedAt: tsToMillis(data.droppinPushedAt),
    },
    payment: {
      method: data.paymentMethod === "card" ? "card" : null,
      stripePaymentIntentId:
        typeof data.stripePaymentIntentId === "string" ? data.stripePaymentIntentId : null,
      amountPaid: typeof data.amountPaid === "number" ? data.amountPaid : null,
      stripeRefundId: typeof data.stripeRefundId === "string" ? data.stripeRefundId : null,
    },
    offer:
      data.offerTier === "none" ||
      data.offerTier === "free_delivery" ||
      data.offerTier === "discount"
        ? {
            tier: data.offerTier,
            discount: Number(data.offerDiscount ?? 0),
            deliveryFeeWaived: Number(data.deliveryFeeWaived ?? 0),
          }
        : null,
  };
}

export type PushOrderResult =
  | { ok: true; trackingNumber: string }
  | { ok: false; error: string };

/**
 * Build a Droppin package from a stored order and push it, persisting the
 * outcome back onto the order document. Used by the admin "Push to Droppin"
 * action for orders that weren't pushed automatically at checkout.
 */
export async function pushOrderToDroppin(
  id: string
): Promise<PushOrderResult> {
  if (!isDroppinConfigured()) {
    return { ok: false, error: "Droppin is not configured." };
  }

  const order = await getOrderById(id);
  if (!order) return { ok: false, error: "Order not found." };
  // Droppin only serves Egypt. US orders are recorded for manual follow-up, so
  // they must never reach the carrier — not via auto-push, and not via the
  // admin's manual button either.
  if (order.region === "us") {
    return { ok: false, error: "US orders aren't shipped with Droppin." };
  }
  if (order.droppin.trackingNumber) {
    return { ok: false, error: "Order is already on Droppin." };
  }

  try {
    const pkg = buildPackageFromOrder({
      id: order.id,
      customer: order.customer,
      shipping: order.shipping,
      items: order.items,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount,
      notes: order.notes,
    });
    const result = await pushPackages([pkg]);
    const created = result.createdPackages?.[0];
    if (result.success && created) {
      await sql`update orders set ${sql({
        droppinPackageId: created.id,
        droppinTrackingNumber: created.trackingNumber,
        droppinStatus: created.status,
        droppinPushedAt: new Date(),
        droppinError: null,
      })} where id = ${id}`;
      return { ok: true, trackingNumber: created.trackingNumber };
    }
    const error = result.error || "Unknown push failure";
    await sql`update orders set ${sql({
      droppinError: error,
      droppinPushAttemptedAt: new Date(),
    })} where id = ${id}`;
    return { ok: false, error };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    try {
      await sql`update orders set ${sql({
        droppinError: error,
        droppinPushAttemptedAt: new Date(),
      })} where id = ${id}`;
    } catch {
      // best-effort
    }
    return { ok: false, error };
  }
}
