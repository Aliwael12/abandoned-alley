// Region-aware pricing. Kept dependency-free (no "use client", no firebase) so
// the storefront, the admin dashboard, and the checkout API all agree on what a
// product costs and which currency it is quoted in.
//
// A product carries the Egypt price in `price` (EGP) and the US price in
// `priceUsd` (USD). They are independent numbers set by the admin — NOT a
// conversion — so a product with no `priceUsd` simply isn't priced for the US
// yet, and must not be sold there.

export type Region = "us" | "eg";
export type Currency = "EGP" | "USD";

export const REGIONS: readonly Region[] = ["eg", "us"] as const;

export const REGION_CURRENCY: Record<Region, Currency> = {
  eg: "EGP",
  us: "USD",
};

/** Short label for admin toggles and order badges. */
export const REGION_LABEL: Record<Region, string> = {
  eg: "Egypt",
  us: "USA",
};

export function isRegion(value: unknown): value is Region {
  return value === "eg" || value === "us";
}

/** Coerce a stored/raw region value, defaulting to Egypt (the original store). */
export function toRegion(value: unknown): Region {
  return isRegion(value) ? value : "eg";
}

export type RegionPriced = { price: number; priceUsd?: number };

/**
 * The price of `p` in `region`, or null when it isn't priced there yet.
 * Null is meaningful: the US store hides unpriced products rather than
 * inventing a number, since the two prices are set independently.
 */
export function priceForRegion(p: RegionPriced, region: Region): number | null {
  if (region === "eg") {
    return Number.isFinite(p.price) ? p.price : null;
  }
  const usd = p.priceUsd;
  return typeof usd === "number" && Number.isFinite(usd) ? usd : null;
}

/** True when the product can be sold in `region`. */
export function isPricedForRegion(p: RegionPriced, region: Region): boolean {
  return priceForRegion(p, region) !== null;
}

/** "EGP 750.00" / "$45.00" — the storefront money format. */
export function formatMoney(amount: number, region: Region): string {
  if (region === "us") return `$${amount.toFixed(2)}`;
  return `EGP ${amount.toFixed(2)}`;
}

/** Same, but from a stored currency code (admin views read orders, not regions). */
export function formatMoneyForCurrency(amount: number, currency: string): string {
  return currency === "USD" ? `$${amount.toFixed(2)}` : `EGP ${amount.toFixed(2)}`;
}
