// Per-size inventory helpers, shared by the storefront, the admin product
// editor, and the order-approval transaction. Stock is stored on the product
// document as a map keyed by SIZE LABEL (the Size option value), e.g.
//   stock: { S: 12, M: 0, L: 3 }
// A missing entry means 0 (sizes start at 0 until the admin sets real counts).

import type { Product, ProductVariant } from "@/lib/products";

/** Per-size stock map: size label -> available units. */
export type StockMap = Record<string, number>;

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

/** A size is sold out when its tracked stock is 0. */
export function isSizeSoldOut(product: Product, size: string): boolean {
  return stockForSize(product.stock, size) <= 0;
}

/** A product is sold out when every one of its sizes is at 0. */
export function isProductSoldOut(product: Product): boolean {
  const sizes = productSizes(product);
  if (!sizes.length) return false;
  return sizes.every((s) => stockForSize(product.stock, s) <= 0);
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
