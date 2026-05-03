import { Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
