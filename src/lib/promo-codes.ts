// Promo code types and pure discount math. Dependency-free (no "use client",
// no firebase) so the storefront, the checkout API, and the admin dashboard
// all agree on how a code discounts an order.
//
// Fixed-amount codes carry an EGP value and an optional USD value — the same
// dual-price convention as `Product.price` / `priceUsd` in pricing.ts. A fixed
// code with no `valueUsd` simply isn't valid for US orders yet.

import { type Region } from "@/lib/pricing";

export type PromoDiscountType = "percentage" | "fixed";

export type PromoCode = {
  /** Uppercased, no whitespace. Also the Firestore doc id. */
  code: string;
  type: PromoDiscountType;
  /** Percentage: 1-100. Fixed: EGP amount off. */
  value: number;
  /** Fixed only: USD amount off. Unset = not redeemable on US orders. */
  valueUsd?: number;
  /** Epoch ms the code stops working, inclusive. Null = never expires. */
  validUntil: number | null;
  active: boolean;
  createdAt?: number;
};

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isPromoExpired(promo: Pick<PromoCode, "validUntil">, now = Date.now()): boolean {
  return promo.validUntil !== null && now > promo.validUntil;
}

/** True when `promo` can be redeemed in `region` at all (ignoring expiry/active). */
export function isPromoUsableInRegion(promo: Pick<PromoCode, "type" | "valueUsd">, region: Region): boolean {
  if (promo.type === "percentage") return true;
  if (region === "eg") return true;
  return typeof promo.valueUsd === "number" && Number.isFinite(promo.valueUsd);
}

export type PromoValidationError =
  | "not_found"
  | "inactive"
  | "expired"
  | "unavailable_in_region";

/** Validate a code against the current time and region, before computing a discount. */
export function validatePromo(
  promo: PromoCode | null,
  region: Region,
  now = Date.now()
): PromoValidationError | null {
  if (!promo) return "not_found";
  if (!promo.active) return "inactive";
  if (isPromoExpired(promo, now)) return "expired";
  if (!isPromoUsableInRegion(promo, region)) return "unavailable_in_region";
  return null;
}

export const PROMO_VALIDATION_MESSAGE: Record<PromoValidationError, string> = {
  not_found: "That code doesn't exist.",
  inactive: "That code is no longer active.",
  expired: "That code has expired.",
  unavailable_in_region: "That code isn't available for your region.",
};

/**
 * The discount `promo` applies to `subtotal` in `region`, clamped to
 * `[0, subtotal]` so a code can never push a total below zero. Assumes
 * `validatePromo` already passed — call sites that skip it get 0 for a code
 * that isn't usable in the region.
 */
export function computePromoDiscount(promo: PromoCode, subtotal: number, region: Region): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  let raw: number;
  if (promo.type === "percentage") {
    raw = subtotal * (promo.value / 100);
  } else {
    raw = region === "us" ? promo.valueUsd ?? 0 : promo.value;
  }
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, subtotal);
}
