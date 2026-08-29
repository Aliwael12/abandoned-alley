// Shared shipping-zone logic used by both the checkout client and the
// checkout/admin API routes. The server is authoritative; the client uses
// these helpers only to preview the fee and delivery indicators.

/**
 * The delivery areas we serve, in the order they appear in the checkout
 * dropdown. Every order is dispatched to Droppin, which accepts a free-text
 * delivery address, so these are the only areas Droppin covers for us:
 * Cairo, Giza, Alexandria, the North Coast (Sahel), and Marsa Matrouh.
 */
export const EGYPT_GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "North Coast",
  "Marsa Matrouh",
] as const;

export type EgyptGovernorate = (typeof EGYPT_GOVERNORATES)[number];

/** Governorates that get the metro rate. Everything else gets the outer rate. */
export const METRO_GOVERNORATES: readonly EgyptGovernorate[] = ["Cairo", "Giza"];

/** Country select values for the Egypt store, which only ships within Egypt. */
export const COUNTRY_EGYPT = "Egypt";
export const COUNTRY_OTHER = "Outside Egypt";

/**
 * The US store's fixed country. US orders are recorded for manual follow-up —
 * they are never dispatched to Droppin (an Egypt-only courier) and carry no
 * shipping fee — so they bypass the zone logic below entirely.
 */
export const COUNTRY_USA = "United States";

export type ShippingZone = "metro" | "egypt" | "international";

export function isEgyptGovernorate(value: string): value is EgyptGovernorate {
  return (EGYPT_GOVERNORATES as readonly string[]).includes(value);
}

/**
 * Resolve the shipping zone from the raw country / governorate values.
 * - "metro": Cairo or Giza — metro rate.
 * - "egypt": Alexandria, North Coast, or Marsa Matrouh — outer rate.
 * - "international": anything else — checkout is blocked.
 * Every served order is dispatched to Droppin regardless of zone.
 */
export function resolveZone(country: string, governorate: string): ShippingZone {
  const c = country.trim().toLowerCase();
  if (c !== COUNTRY_EGYPT.toLowerCase() && c !== "eg" && c !== "egy") {
    return "international";
  }
  const g = governorate.trim();
  if (!isEgyptGovernorate(g)) return "international";
  return (METRO_GOVERNORATES as readonly string[]).includes(g)
    ? "metro"
    : "egypt";
}

export type ShippingFees = { metro: number; outer: number };

export function feeForZone(zone: ShippingZone, fees: ShippingFees): number {
  if (zone === "metro") return fees.metro;
  if (zone === "egypt") return fees.outer;
  return 0;
}

export const DEFAULT_SHIPPING_FEES: ShippingFees = { metro: 80, outer: 100 };
