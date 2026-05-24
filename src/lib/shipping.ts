// Shared shipping-zone logic used by both the checkout client and the
// checkout/admin API routes. The server is authoritative; the client uses
// these helpers only to preview the fee and delivery indicators.

/** The 27 governorates of Egypt (English canonical names). */
export const EGYPT_GOVERNORATES = [
  "Cairo",
  "Giza",
  "Alexandria",
  "Dakahlia",
  "Red Sea",
  "Beheira",
  "Fayoum",
  "Gharbia",
  "Ismailia",
  "Menofia",
  "Minya",
  "Qaliubiya",
  "New Valley",
  "Suez",
  "Aswan",
  "Assiut",
  "Beni Suef",
  "Port Said",
  "Damietta",
  "Sharkia",
  "South Sinai",
  "Kafr El Sheikh",
  "Matrouh",
  "Luxor",
  "Qena",
  "North Sinai",
  "Sohag",
] as const;

export type EgyptGovernorate = (typeof EGYPT_GOVERNORATES)[number];

/** Governorates that get the metro rate and an automatic Droppin push. */
export const METRO_GOVERNORATES: readonly EgyptGovernorate[] = ["Cairo", "Giza"];

/** Country select values. We only ship within Egypt. */
export const COUNTRY_EGYPT = "Egypt";
export const COUNTRY_OTHER = "Outside Egypt";

export type ShippingZone = "metro" | "egypt" | "international";

export function isEgyptGovernorate(value: string): value is EgyptGovernorate {
  return (EGYPT_GOVERNORATES as readonly string[]).includes(value);
}

/**
 * Resolve the shipping zone from the raw country / governorate values.
 * - "metro": Cairo or Giza — metro rate, auto-pushed to Droppin.
 * - "egypt": any other Egyptian governorate — outer rate, manual Droppin push.
 * - "international": anything else — checkout is blocked.
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
