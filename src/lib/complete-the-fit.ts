// "Complete the fit": the one clothing piece the cart suggests to move the
// shopper toward the next spend-offer tier. Pure, so it's easy to reason about:
//   - only tops in the bag → suggest a bottom; only bottoms → a top; both (or
//     neither) → whichever piece gets the bag closest to the next tier
//   - matching pairs (Product.pairsWith, either direction) come first
//   - never something already in the bag, sold out, unpriced, disabled, or
//     not clothing (hats, pins)

import { isProductSoldOut } from "@/lib/inventory";
import { offerTier, type OfferConfig } from "@/lib/offer";
import { priceForRegion, type Region } from "@/lib/pricing";
import type { Product } from "@/lib/products";

type FitRole = "top" | "bottom";

/** Tees are tops; sweats (pants and shorts) are bottoms; anything else isn't
 * part of an outfit suggestion. */
export function fitRole(p: Pick<Product, "category">): FitRole | null {
  if (p.category === "tees") return "top";
  if (p.category === "sweats") return "bottom";
  return null;
}

function pairs(a: Product, b: Product): boolean {
  return !!(a.pairsWith?.includes(b.handle) || b.pairsWith?.includes(a.handle));
}

export type FitPick = {
  product: Product;
  price: number;
  /** What adding it unlocks, or null when it only narrows the gap. */
  unlocks: "free_delivery" | "discount" | null;
  /** Gap to the discount after adding it (0 once reached). */
  gapAfter: number;
};

export function pickCompleteTheFit({
  catalog,
  bagHandles,
  subtotal,
  offer,
  region,
}: {
  catalog: Product[];
  bagHandles: string[];
  subtotal: number;
  offer: OfferConfig;
  region: Region;
}): FitPick | null {
  if (offerTier(offer, subtotal) === "discount") return null;

  const inBag = new Set(bagHandles);
  const bag = catalog.filter((p) => inBag.has(p.handle));
  const hasTop = bag.some((p) => fitRole(p) === "top");
  const hasBottom = bag.some((p) => fitRole(p) === "bottom");
  const wanted: FitRole[] =
    hasTop && !hasBottom ? ["bottom"] : hasBottom && !hasTop ? ["top"] : ["top", "bottom"];

  // The next threshold the shopper hasn't reached yet.
  const target = subtotal < offer.freeDeliveryAt ? offer.freeDeliveryAt : offer.discountAt;

  const candidates = catalog
    .filter((p) => {
      const role = fitRole(p);
      return (
        role !== null &&
        wanted.includes(role) &&
        !inBag.has(p.handle) &&
        !p.disabled &&
        !isProductSoldOut(p, region) &&
        priceForRegion(p, region) !== null
      );
    })
    .map((p) => {
      const price = priceForRegion(p, region)!;
      return {
        product: p,
        price,
        paired: bag.some((b) => pairs(b, p)),
        shortfall: Math.max(0, target - (subtotal + price)),
      };
    })
    // Pairs first, then whatever leaves the smallest gap to the next tier,
    // then the cheaper piece.
    .sort(
      (a, b) =>
        Number(b.paired) - Number(a.paired) || a.shortfall - b.shortfall || a.price - b.price
    );

  const best = candidates[0];
  if (!best) return null;
  const after = subtotal + best.price;
  return {
    product: best.product,
    price: best.price,
    unlocks:
      after >= offer.discountAt
        ? "discount"
        : subtotal < offer.freeDeliveryAt && after >= offer.freeDeliveryAt
        ? "free_delivery"
        : null,
    gapAfter: Math.max(0, Math.ceil(offer.discountAt - after)),
  };
}
