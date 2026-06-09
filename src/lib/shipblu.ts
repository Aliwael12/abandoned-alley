// ShipBlu carrier client. Docs: https://docs.shipblu.com
// Base: https://api.shipblu.com/api/v1/  Auth: header `Authorization: Api-Key <KEY>`
// Used for non-metro Egyptian governorates (Cairo/Giza stay on Droppin).
//
// The API key is a SECRET — only ever read it from the env here on the server.
// Storefront geography lookups go through our own /api/shipblu/* proxy routes
// so the key never reaches the browser.

const BASE_URL =
  process.env.SHIPBLU_BASE_URL || "https://api.shipblu.com/api/v1";

// Default package size id for apparel. The /package-sizes/ endpoint is
// permission-gated (403), and "1" is the smallest/standard size. Guarded so a
// malformed env var can't serialize package_size as null/NaN in the payload.
const DEFAULT_PACKAGE_SIZE = (() => {
  const n = Number(process.env.SHIPBLU_PACKAGE_SIZE);
  return Number.isInteger(n) && n > 0 ? n : 1;
})();

function apiKey(): string | null {
  const key = process.env.SHIPBLU_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function isShipBluConfigured(): boolean {
  return apiKey() !== null;
}

function authHeaders(): HeadersInit {
  const key = apiKey();
  if (!key) throw new Error("SHIPBLU_API_KEY is not set");
  return {
    Authorization: `Api-Key ${key}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export type ShipBluGovernorate = { id: number; name: string; code: string | null };
export type ShipBluCity = { id: number; name: string };
export type ShipBluZone = { id: number; name: string };

type ListLike<T> = T[] | { results?: T[] };

function asList<T>(data: ListLike<T>): T[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data.results) ? data.results : [];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ShipBlu ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function getGovernorates(): Promise<ShipBluGovernorate[]> {
  const data = await getJson<ListLike<ShipBluGovernorate>>("/governorates/");
  return asList(data).map((g) => ({ id: g.id, name: g.name, code: g.code ?? null }));
}

export async function getCities(governorateId: number): Promise<ShipBluCity[]> {
  const data = await getJson<ListLike<ShipBluCity>>(
    `/governorates/${governorateId}/cities/`
  );
  return asList(data).map((c) => ({ id: c.id, name: c.name }));
}

export async function getZones(cityId: number): Promise<ShipBluZone[]> {
  const data = await getJson<ListLike<ShipBluZone>>(`/cities/${cityId}/zones/`);
  return asList(data).map((z) => ({ id: z.id, name: z.name }));
}

// ---------------------------------------------------------------------------
// Governorate mapping — our canonical English names -> ShipBlu governorate id.
// Verified against the live /governorates/ list (June 2026). The five Egyptian
// governorates ShipBlu does NOT serve are intentionally absent.
// ---------------------------------------------------------------------------

export const SHIPBLU_GOVERNORATE_IDS: Record<string, number> = {
  Cairo: 1, // routed to Droppin, mapped for completeness
  Giza: 16, // routed to Droppin
  Alexandria: 2,
  Dakahlia: 4,
  Beheira: 8,
  Fayoum: 11,
  Gharbia: 7,
  Ismailia: 13,
  Menofia: 6,
  Minya: 21,
  Qaliubiya: 5,
  Suez: 14,
  Aswan: 25,
  Assiut: 10,
  "Beni Suef": 12,
  "Port Said": 18,
  Damietta: 17,
  Sharkia: 19,
  "Kafr El Sheikh": 9,
  Luxor: 24,
  Qena: 23,
  Sohag: 22,
  // NOT served by ShipBlu: Red Sea, New Valley, South Sinai, Matrouh, North Sinai
};

export function shipbluGovernorateId(name: string): number | null {
  return SHIPBLU_GOVERNORATE_IDS[name.trim()] ?? null;
}

/** True when ShipBlu serves the given (our-canonical) governorate name. */
export function isShipBluServed(name: string): boolean {
  return shipbluGovernorateId(name) !== null;
}

// ---------------------------------------------------------------------------
// Create delivery order
// ---------------------------------------------------------------------------

export type ShipBluOrderInput = {
  id: string;
  customer: { name: string; email: string; phone: string };
  // ShipBlu's address uses line_1 / line_2 / zone only — no postal code.
  shipping: { address: string; city: string; state: string };
  zoneId: number;
  items: { title: string; variantTitle: string; quantity: number }[];
  /** Cash to collect on delivery (subtotal + shipping). */
  cashAmount: number;
  notes?: string | null;
};

/** A ShipBlu delivery order as we persist it back onto the Firestore order. */
export type ShipBluCreatedOrder = {
  id: number | null;
  trackingNumber: string | null;
  status: string | null;
};

export type ShipBluCreateResult =
  | { ok: true; order: ShipBluCreatedOrder }
  | { ok: false; error: string };

function buildBody(order: ShipBluOrderInput) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const description = order.items
    .map((i) => `${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ""} x${i.quantity}`)
    .join(", ")
    .slice(0, 250);
  const line1 = order.shipping.address || ".";
  const line2 = [order.shipping.city, order.shipping.state]
    .filter(Boolean)
    .join(", ") || ".";
  return {
    customer: {
      full_name: order.customer.name,
      email: order.customer.email || undefined,
      phone: order.customer.phone,
      address: {
        line_1: line1,
        line_2: line2,
        zone: order.zoneId,
      },
    },
    packages: [
      {
        package_size: DEFAULT_PACKAGE_SIZE,
        description: description || `Order ${order.id.slice(0, 8)} (${itemCount} items)`,
      },
    ],
    cash_amount: Math.max(0, Math.round(order.cashAmount)),
    merchant_order_reference: order.id,
    order_notes: order.notes || undefined,
  };
}

/** Pull a tracking number out of ShipBlu's create response, tolerant of shape. */
function extractCreated(data: Record<string, unknown>): ShipBluCreatedOrder {
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  // ShipBlu has historically keyed tracking under a few names; try each.
  const tracking =
    str(data.tracking_number) ??
    str(data.trackingNumber) ??
    str(data.tracking_id) ??
    (num(data.id) !== null ? String(num(data.id)) : null);
  return {
    id: num(data.id),
    trackingNumber: tracking,
    status: str(data.status) ?? str(data.delivery_status),
  };
}

export async function createDeliveryOrder(
  order: ShipBluOrderInput
): Promise<ShipBluCreateResult> {
  if (!isShipBluConfigured()) {
    return { ok: false, error: "ShipBlu is not configured." };
  }
  try {
    const res = await fetch(`${BASE_URL}/delivery-orders/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(buildBody(order)),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      // non-JSON body
    }
    if (!res.ok) {
      const detail =
        (typeof data.detail === "string" && data.detail) ||
        (text ? text.slice(0, 300) : `HTTP ${res.status}`);
      return { ok: false, error: `ShipBlu rejected the order: ${detail}` };
    }
    const created = extractCreated(data);
    // A 2xx with neither a tracking number nor an order id is an unusable
    // response — don't mark the order dispatched on it.
    if (created.trackingNumber === null && created.id === null) {
      return {
        ok: false,
        error: "ShipBlu accepted the order but returned no tracking number.",
      };
    }
    return { ok: true, order: created };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ShipBlu request failed.",
    };
  }
}
