import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildPackageFromOrder,
  isDroppinConfigured,
  pushPackages,
} from "@/lib/droppin";
import type { ShippingZone } from "@/lib/shipping";

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
  shippingFee: number;
  currency: string;
  status: string;
  shippingZone: ShippingZone;
  droppinAutoPush: boolean;
  createdAt: number | null;
  droppin: {
    packageId: number | null;
    trackingNumber: string | null;
    status: string | null;
    error: string | null;
    pushedAt: number | null;
  };
};

function tsToMillis(ts: unknown): number | null {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === "object" && "seconds" in ts) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return null;
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const snap = await getDoc(doc(db, "orders", id));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const shipping = (data.shipping ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items) ? (data.items as OrderItem[]) : [];

  return {
    id: snap.id,
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
    shippingFee: Number(data.shippingFee ?? 0),
    currency: String(data.currency ?? "EGP"),
    status: String(data.status ?? "pending"),
    shippingZone:
      data.shippingZone === "egypt" ||
      data.shippingZone === "international" ||
      data.shippingZone === "metro"
        ? (data.shippingZone as ShippingZone)
        : "metro",
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
      notes: order.notes,
    });
    const result = await pushPackages([pkg]);
    const created = result.createdPackages?.[0];
    if (result.success && created) {
      await updateDoc(doc(db, "orders", id), {
        droppinPackageId: created.id,
        droppinTrackingNumber: created.trackingNumber,
        droppinStatus: created.status,
        droppinPushedAt: serverTimestamp(),
        droppinError: null,
      });
      return { ok: true, trackingNumber: created.trackingNumber };
    }
    const error = result.error || "Unknown push failure";
    await updateDoc(doc(db, "orders", id), {
      droppinError: error,
      droppinPushAttemptedAt: serverTimestamp(),
    });
    return { ok: false, error };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    try {
      await updateDoc(doc(db, "orders", id), {
        droppinError: error,
        droppinPushAttemptedAt: serverTimestamp(),
      });
    } catch {
      // best-effort
    }
    return { ok: false, error };
  }
}
