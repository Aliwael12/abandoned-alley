"use client";

import type { Product } from "@/lib/products";
import { isPricedForRegion } from "@/lib/pricing";
import { useRegionOrDefault } from "@/lib/region";
import ProductCard from "./ProductCard";

/**
 * The listing grid, filtered to what the active region actually sells. The two
 * prices are set independently by the admin, so a product with no USD price
 * isn't priced for the US yet and is hidden there rather than shown at a price
 * that doesn't exist.
 */
export default function ProductGrid({
  products,
  collectionTitles,
  emptyMessage = "Nothing here yet.",
}: {
  products: Product[];
  /** collection handle -> display title, so cards show "WASTED SUMMER" not "004". */
  collectionTitles?: Record<string, string>;
  emptyMessage?: string;
}) {
  const region = useRegionOrDefault();
  const visible = products.filter((p) => isPricedForRegion(p, region));

  if (visible.length === 0) {
    return (
      <p className="aa-body" style={{ color: "var(--text-muted)", textAlign: "center" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="aa-grid">
      {visible.map((p) => (
        <div key={p.handle} style={{ gridColumn: "span 4" }}>
          <ProductCard product={p} collectionTitle={collectionTitles?.[p.collection]} />
        </div>
      ))}
    </div>
  );
}
