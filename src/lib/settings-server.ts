import { sql } from "@/lib/db";
import { DEFAULT_SHIPPING_FEES, type ShippingFees } from "@/lib/shipping";
import { DEFAULT_OFFER, normalizeOffer, type OfferConfig } from "@/lib/offer";

// Settings live as small JSON documents keyed by name: "store" (shipping fees,
// default size chart) and "offer" (the Egypt spend offer). Separate keys, so
// the store settings form and the offer panel never overwrite each other.
const STORE = "store";
const OFFER = "offer";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return v !== null && v !== undefined && Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function readSettings(key: string): Promise<Record<string, unknown> | null> {
  const [row] = await sql`select data from settings where key = ${key}`;
  return row ? (row.data as Record<string, unknown>) : null;
}

/** Merge `patch` into the named settings document, creating it if needed. */
async function mergeSettings(key: string, patch: Record<string, unknown>): Promise<void> {
  await sql`
    insert into settings (key, data, updated_at) values (${key}, ${sql.json(patch as never)}, now())
    on conflict (key) do update set data = settings.data || excluded.data, updated_at = now()`;
}

export async function getShippingFees(): Promise<ShippingFees> {
  try {
    const data = await readSettings(STORE);
    if (data) {
      // Fall back to the legacy single `shippingFee` field if the per-zone
      // fields haven't been set yet.
      const legacy = data.shippingFee;
      return {
        metro: num(data.metroShippingFee, num(legacy, DEFAULT_SHIPPING_FEES.metro)),
        outer: num(data.outerShippingFee, num(legacy, DEFAULT_SHIPPING_FEES.outer)),
      };
    }
  } catch (err) {
    console.error("getShippingFees failed:", err);
  }
  return { ...DEFAULT_SHIPPING_FEES };
}

export async function setShippingFees(fees: ShippingFees): Promise<void> {
  await mergeSettings(STORE, { metroShippingFee: fees.metro, outerShippingFee: fees.outer });
}

export async function getDefaultSizeChartHandle(): Promise<string | null> {
  try {
    const v = (await readSettings(STORE))?.defaultSizeChartHandle;
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch (err) {
    console.error("getDefaultSizeChartHandle failed:", err);
  }
  return null;
}

export async function setDefaultSizeChartHandle(handle: string | null): Promise<void> {
  await mergeSettings(STORE, { defaultSizeChartHandle: handle ?? "" });
}

export async function getOfferConfig(): Promise<OfferConfig> {
  try {
    const data = await readSettings(OFFER);
    if (data) return normalizeOffer(data);
  } catch (err) {
    // Fail closed: if the settings can't be read, nobody gets an offer they
    // were never shown — the order goes through at normal prices.
    console.error("getOfferConfig failed:", err);
  }
  return { ...DEFAULT_OFFER };
}

export async function setOfferConfig(offer: OfferConfig): Promise<void> {
  await sql`
    insert into settings (key, data, updated_at) values (${OFFER}, ${sql.json(offer as never)}, now())
    on conflict (key) do update set data = excluded.data, updated_at = now()`;
}
