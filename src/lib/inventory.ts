// Per-size inventory helpers, shared by the storefront, the admin product
// editor, and the order transactions. Stock is stored on the product document
// as a map keyed by SIZE LABEL (the Size option value), e.g.
//   stock: { S: 12, M: 0, L: 3 }
// A missing entry means 0 (sizes start at 0 until the admin sets real counts).
//
// The two stores hold separate inventory, so a product carries two such maps:
// Egypt's in `stock` and New York's in `stockUs` (the same base / `Us`-suffix
// split as `price` / `priceUsd`). A shopper can only ever buy from their own
// store's count, so every helper that asks "is this available?" takes the region.

import type { Region } from "@/lib/pricing";
import type { Product, ProductVariant } from "@/lib/products";

/** Per-size stock map: size label -> available units. */
export type StockMap = Record<string, number>;

/** Which Product field holds each store's stock map. */
export const STOCK_FIELD: Record<Region, "stock" | "stockUs"> = {
  eg: "stock",
  us: "stockUs",
};

/** The stock map `region`'s store sells from. */
export function stockMapForRegion(
  product: Pick<Product, "stock" | "stockUs">,
  region: Region
): StockMap | undefined {
  return product[STOCK_FIELD[region]];
}

/** Default low-stock threshold; the admin can override per request later. */
export const LOW_STOCK_THRESHOLD = 2;

/** Coerce an arbitrary value into a clean, non-negative integer stock map. */
export function normalizeStock(raw: unknown): StockMap {
  if (!raw || typeof raw !== "object") return {};
  const out: StockMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const size = String(key).trim();
    if (!size) continue;
    const n = Math.floor(Number(value));
    out[size] = Number.isFinite(n) && n > 0 ? n : 0;
  }
  return out;
}

/** Stock for one size label; missing -> 0. */
export function stockForSize(stock: StockMap | undefined, size: string): number {
  if (!stock) return 0;
  const n = stock[size];
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The size label for a variant — the value of its "Size" option, falling back
 * to the variant title (which is the size for this catalog).
 */
export function sizeOfVariant(variant: ProductVariant): string {
  const opt = variant.options?.Size ?? variant.options?.size;
  return String(opt ?? variant.title ?? "").trim();
}

/**
 * Resolve the size label for an order line item against a product. Order items
 * store variantId + variantTitle but no structured size, so we match the
 * variant by id and read its Size option, falling back to the item's title.
 */
export function sizeOfOrderItem(
  item: { variantId: string; variantTitle: string },
  product: Product | undefined
): string {
  if (product) {
    const v = product.variants.find((x) => x.id === item.variantId);
    if (v) return sizeOfVariant(v);
  }
  return String(item.variantTitle ?? "").trim();
}

/** The list of size labels a product sells (from its Size option / variants). */
export function productSizes(product: Product): string[] {
  const sizeOpt = product.options.find(
    (o) => o.name.toLowerCase() === "size"
  );
  if (sizeOpt && sizeOpt.values.length) return sizeOpt.values;
  return product.variants.map((v) => sizeOfVariant(v));
}

/** A size is sold out in `region`'s store when its stock there is 0. */
export function isSizeSoldOut(
  product: Product,
  size: string,
  region: Region
): boolean {
  return stockForSize(stockMapForRegion(product, region), size) <= 0;
}

/** A product is sold out in `region`'s store when every one of its sizes is at 0 there. */
export function isProductSoldOut(product: Product, region: Region): boolean {
  const sizes = productSizes(product);
  if (!sizes.length) return false;
  const stock = stockMapForRegion(product, region);
  return sizes.every((s) => stockForSize(stock, s) <= 0);
}

/** Low stock: at or below the threshold but not yet sold out. */
export function isLowStock(
  qty: number,
  threshold: number = LOW_STOCK_THRESHOLD
): boolean {
  return qty > 0 && qty <= threshold;
}

export type StockBadge = "soldout" | "low" | "ok";

export function stockBadge(
  qty: number,
  threshold: number = LOW_STOCK_THRESHOLD
): StockBadge {
  if (qty <= 0) return "soldout";
  if (qty <= threshold) return "low";
  return "ok";
}
