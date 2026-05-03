const BASE_URL = process.env.DROPPIN_BASE_URL || "https://api.droppin-eg.com";

export type DroppinPushItem = {
  description: string;
  quantity: number;
  codPerUnit: number;
};

export type DroppinPushPackage = {
  packageDescription: string;
  weight?: number;
  dimensions?: string;
  pickupContactName: string;
  pickupContactPhone: string;
  pickupAddress: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  deliveryAddress: string;
  schedulePickupTime?: string;
  priority?: "normal" | "express";
  codAmount: number;
  deliveryCost?: number;
  shownDeliveryCost?: number;
  paymentMethod?: "cash" | "card" | "online";
  paymentNotes?: string;
  shopNotes?: string;
  itemsNo: number;
  shopifyOrderId?: string;
  shopifyOrderName?: string;
  shopifyShippingFee?: number;
  items: DroppinPushItem[];
};

export type DroppinCreatedPackage = {
  id: number;
  trackingNumber: string;
  status: string;
};

export type DroppinPushResult = {
  success: boolean;
  createdPackages?: DroppinCreatedPackage[];
  error?: string;
};

export type DroppinPackageRecord = {
  id: number;
  trackingNumber: string;
  status: string;
  codAmount?: number;
  deliveryCost?: number;
  shownDeliveryCost?: number;
  shopifyOrderId?: string;
  shopifyOrderName?: string;
};

function apiKey(): string | null {
  const key = process.env.DROPPIN_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

function authHeaders(): HeadersInit {
  const key = apiKey();
  if (!key) throw new Error("DROPPIN_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function isDroppinConfigured(): boolean {
  return apiKey() !== null;
}

export async function pushPackages(
  packages: DroppinPushPackage[],
  shopDomain?: string
): Promise<DroppinPushResult> {
  const res = await fetch(`${BASE_URL}/api/packages/shopify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      shopDomain: shopDomain || process.env.DROPPIN_SHOP_DOMAIN || undefined,
      packages,
    }),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : null) || `Droppin push failed (HTTP ${res.status})`;
    return { success: false, error: msg };
  }

  return (body as DroppinPushResult) ?? { success: true };
}

export async function getSentOrderIds(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/api/packages/shopify/sent-ids`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Droppin sent-ids failed (HTTP ${res.status})`);
  const data = (await res.json()) as { sent?: string[] };
  return Array.isArray(data.sent) ? data.sent : [];
}

export async function getPackage(id: number | string): Promise<DroppinPackageRecord> {
  const res = await fetch(`${BASE_URL}/api/packages/${id}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Droppin getPackage failed (HTTP ${res.status})`);
  return (await res.json()) as DroppinPackageRecord;
}

export type OrderForDroppin = {
  id: string;
  customer: { name: string; email: string; phone: string };
  shipping: { address: string; city: string; state: string; zip: string; country: string };
  items: { title: string; variantTitle: string; price: number; quantity: number }[];
  subtotal: number;
  shippingFee: number;
  notes?: string | null;
};

export function buildPackageFromOrder(order: OrderForDroppin): DroppinPushPackage {
  const pickupName = process.env.DROPPIN_PICKUP_NAME?.trim() || "Shop";
  const pickupPhone = process.env.DROPPIN_PICKUP_PHONE?.trim() || "";
  const pickupAddress = process.env.DROPPIN_PICKUP_ADDRESS?.trim() || "";
  const deliveryCost = order.shippingFee;

  const fullAddress = [
    order.shipping.address,
    order.shipping.city,
    order.shipping.state,
    order.shipping.zip,
    order.shipping.country,
  ]
    .filter(Boolean)
    .join(", ");

  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return {
    packageDescription: `Order #${order.id.slice(0, 8)}`,
    weight: 1,
    dimensions: "30x20x10",
    pickupContactName: pickupName,
    pickupContactPhone: pickupPhone,
    pickupAddress,
    deliveryContactName: order.customer.name,
    deliveryContactPhone: order.customer.phone,
    deliveryAddress: fullAddress,
    priority: "normal",
    codAmount: order.subtotal + deliveryCost,
    deliveryCost,
    shownDeliveryCost: deliveryCost,
    paymentMethod: "cash",
    shopNotes: order.notes || undefined,
    itemsNo: itemCount,
    shopifyOrderId: `firestore:orders/${order.id}`,
    shopifyOrderName: `#${order.id.slice(0, 8)}`,
    items: order.items.map((it) => ({
      description: [it.title, it.variantTitle].filter(Boolean).join(" — "),
      quantity: it.quantity,
      codPerUnit: it.price,
    })),
  };
}
