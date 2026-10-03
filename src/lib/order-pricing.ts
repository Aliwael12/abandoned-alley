// Server-side line-item pricing for checkout. The bag in the browser remembers
// the price each item was added at, but that copy lives in the shopper's
// localStorage and is theirs to edit — so checkout re-prices every line from
// the product documents and never records, or charges, a client-sent amount.

import { priceForRegion, type Region } from "@/lib/pricing";
import type { Product, ProductVariant } from "@/lib/products";

type ItemRef = {
  productHandle: string;
  variantId: string;
  variantTitle: string;
  title: string;
};

/** A line that can't be sold as asked: the product or variant is gone,
 * disabled, or not priced in this store. */
export class UnpricedItemError extends Error {
  readonly title: string;
  constructor(title: string) {
    super(`${title} is no longer available`);
    this.name = "UnpricedItemError";
    this.title = title;
  }
}

/**
 * The variant an order line refers to. Pin packs append the chosen designs to
 * the variant id (`<id>-<pins>`, see ProductDetail), so fall back to the
 * variant title, which the cart carries verbatim — the same fallback
 * sizeOfOrderItem uses for stock.
 */
function variantForItem(product: Product, item: ItemRef): ProductVariant | undefined {
  return (
    product.variants.find((v) => v.id === item.variantId) ??
    product.variants.find((v) => v.title === item.variantTitle)
  );
}

/**
 * Attach the authoritative unit price to every line, resolved exactly as the
 * product page quotes it: the variant's own price, then the product's for
 * variants that predate per-variant pricing. Throws UnpricedItemError for a
 * line that can't be bought in `region`.
 */
export function priceItems<T extends ItemRef>(
  items: T[],
  productByHandle: Map<string, Product>,
  region: Region
): (T & { price: number })[] {
  return items.map((item) => {
    const product = productByHandle.get(item.productHandle);
    const variant = product && !product.disabled ? variantForItem(product, item) : undefined;
    const price =
      product && variant
        ? priceForRegion(variant, region) ?? priceForRegion(product, region)
        : null;
    if (price === null) throw new UnpricedItemError(item.title || item.productHandle);
    return { ...item, price };
  });
}
