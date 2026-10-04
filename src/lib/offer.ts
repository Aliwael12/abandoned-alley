// The Egypt spend offer: free delivery from one subtotal, a fixed amount off
// plus free delivery from a higher one. Automatic — no code to enter — and
// time-boxed. Every number and date lives in Firestore (`settings/offer`,
// edited from the admin Settings tab), so the offer can be started, stopped,
// or re-tuned for the next campaign without a deploy.
//
// Dependency-free (no "use client", no firebase) so the cart, the checkout
// API, and the admin dashboard all compute the same tiers and totals. The
// server's calculation is the one that counts; the cart only previews it.

import type { Region } from "@/lib/pricing";

export type OfferConfig = {
  /** Master switch. Off = the offer doesn't exist, whatever the dates say. */
  enabled: boolean;
  /** Epoch ms the offer starts (inclusive). Null = no start limit. */
  startsAt: number | null;
  /** Epoch ms the offer ends (exclusive). Null = no end limit. */
  endsAt: number | null;
  /** Subtotal (EGP) that unlocks free delivery. */
  freeDeliveryAt: number;
  /** Subtotal (EGP) that unlocks the discount, on top of free delivery. */
  discountAt: number;
  /** EGP off at the discount tier. */
  discountAmount: number;
};

export const DEFAULT_OFFER: OfferConfig = {
  enabled: false,
  startsAt: null,
  endsAt: null,
  freeDeliveryAt: 1000,
  discountAt: 1800,
  discountAmount: 300,
};

/** Which reward the subtotal reached. */
export type OfferTier = "none" | "free_delivery" | "discount";

/** Placeholder copy until the copywriter's lines arrive — kept in one place
 * so swapping them in touches nothing else. */
export const OFFER_COPY = {
  discountLabel: (amount: number) => `${amount} OFF offer`,
  freeDelivery: "FREE",
  saved: (amount: number) => `You saved EGP ${amount}`,
  codeBeatsOffer: "Your code saves more than the spend offer, so the code is applied.",
  offerBeatsCode: "The spend offer saves you more than your code, so the offer is applied instead.",
  offerEnded: "The spend offer has ended, so this order is at normal prices.",
};

function finite(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** Coerce a stored settings document into a usable config. */
export function normalizeOffer(raw: unknown): OfferConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const time = (v: unknown) => {
    const n = Number(v);
    return v != null && Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    enabled: r.enabled === true,
    startsAt: time(r.startsAt),
    endsAt: time(r.endsAt),
    freeDeliveryAt: finite(r.freeDeliveryAt, DEFAULT_OFFER.freeDeliveryAt),
    discountAt: finite(r.discountAt, DEFAULT_OFFER.discountAt),
    discountAmount: finite(r.discountAmount, DEFAULT_OFFER.discountAmount),
  };
}

/** True when the offer applies to a `region` cart right now. Egypt only. */
export function isOfferLive(
  offer: OfferConfig | null | undefined,
  region: Region,
  now: number = Date.now()
): boolean {
  if (!offer || !offer.enabled || region !== "eg") return false;
  if (offer.startsAt !== null && now < offer.startsAt) return false;
  if (offer.endsAt !== null && now >= offer.endsAt) return false;
  return true;
}

export function offerTier(offer: OfferConfig, subtotal: number): OfferTier {
  if (subtotal >= offer.discountAt) return "discount";
  if (subtotal >= offer.freeDeliveryAt) return "free_delivery";
  return "none";
}

/** How far the cart is from each reward, in whole EGP (never negative). */
export function offerGaps(offer: OfferConfig, subtotal: number) {
  return {
    toFreeDelivery: Math.max(0, Math.ceil(offer.freeDeliveryAt - subtotal)),
    toDiscount: Math.max(0, Math.ceil(offer.discountAt - subtotal)),
  };
}

export type CheckoutTotals = {
  subtotal: number;
  /** The delivery fee the zone normally costs. */
  normalShippingFee: number;
  /** What the customer actually pays for delivery. */
  shippingFee: number;
  /** Delivery fee the offer took off (0 when it didn't). */
  deliveryFeeWaived: number;
  /** Total money off the products — the offer's amount or the code's. */
  discountAmount: number;
  /** The offer's share of discountAmount (0 when a code won). */
  offerDiscount: number;
  /** The code that applied, or null when there was none or the offer won. */
  promoCode: string | null;
  /** The offer tier reached, or null when the offer isn't running. A cart
   * where a code won records "none": the offer gave it nothing. */
  offerTier: OfferTier | null;
  /** What decided the price when both were possible, for the cart's note. */
  outcome: "offer_beat_code" | "code_beat_offer" | null;
  total: number;
  /** Discount plus waived delivery. */
  saved: number;
};

/**
 * The order's totals. The offer and a promo code never stack: whichever saves
 * the customer more applies (the offer on a tie, since it needs no code).
 * Pass `offer` only when isOfferLive says it applies to this cart.
 */
export function checkoutTotals({
  subtotal,
  shippingFee,
  offer,
  promo,
}: {
  subtotal: number;
  shippingFee: number;
  offer: OfferConfig | null;
  promo: { code: string; discount: number } | null;
}): CheckoutTotals {
  const tier = offer ? offerTier(offer, subtotal) : null;
  const offerDiscount =
    offer && tier === "discount" ? Math.min(offer.discountAmount, subtotal) : 0;
  const offerWaived = tier && tier !== "none" ? shippingFee : 0;
  const offerSaving = offerDiscount + offerWaived;
  const promoSaving = promo ? Math.min(Math.max(promo.discount, 0), subtotal) : 0;

  const codeWins = !!promo && promoSaving > offerSaving;
  const discountAmount = codeWins ? promoSaving : offerDiscount;
  const deliveryFeeWaived = codeWins ? 0 : offerWaived;
  const charged = shippingFee - deliveryFeeWaived;
  return {
    subtotal,
    normalShippingFee: shippingFee,
    shippingFee: charged,
    deliveryFeeWaived,
    discountAmount,
    offerDiscount: codeWins ? 0 : offerDiscount,
    promoCode: codeWins ? promo!.code : offer ? null : promo?.code ?? null,
    offerTier: tier === null ? null : codeWins ? "none" : tier,
    // Only worth a note when both would actually have saved something.
    outcome:
      promoSaving > 0 && offerSaving > 0
        ? codeWins
          ? "code_beat_offer"
          : "offer_beat_code"
        : null,
    total: subtotal - discountAmount + charged,
    saved: discountAmount + deliveryFeeWaived,
  };
}
