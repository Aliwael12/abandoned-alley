// Visitor location -> storefront. Dependency-free so proxy.ts (which reads the
// host's geolocation headers) and the client region store (which acts on them)
// share one definition.

import type { Region } from "@/lib/pricing";

/** Cookie proxy.ts stamps with the visitor's ISO 3166-1 alpha-2 country. */
export const COUNTRY_COOKIE = "aa-country";

/**
 * The visitor's country from the host's edge geolocation — Vercel's header, or
 * Cloudflare's if it sits in front. Null when there is none (local dev) or the
 * IP can't be placed, which leaves the store to the manual /region choice.
 */
export function countryFromHeaders(headers: Headers): string | null {
  const raw = (headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  // XX is Cloudflare's "unknown", T1 a Tor exit node — neither is a place.
  if (!/^[A-Z]{2}$/.test(raw) || raw === "XX" || raw === "T1") return null;
  return raw;
}

/**
 * The store a country shops in, or null when neither store ships there. The
 * New York store takes the whole US — its checkout already accepts any state.
 */
export function regionForCountry(country: string): Region | null {
  if (country === "EG") return "eg";
  if (country === "US") return "us";
  return null;
}

/** "FR" -> "France", for the "we don't ship to …" notice. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
