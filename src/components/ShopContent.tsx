"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import type { CollectionMeta } from "@/lib/collections-server";
import { useRequireRegion } from "@/lib/region";
import { Button } from "./ui";
import ProductCard from "./ProductCard";

export default function ShopContent({
  products,
  collections,
}: {
  products: Product[];
  collections: CollectionMeta[];
}) {
  const { ready } = useRequireRegion();
  const searchParams = useSearchParams();
  const initial = searchParams.get("category")?.toUpperCase() ?? "ALL";
  const validFilters = useMemo(() => ["ALL", ...collections.map((c) => c.handle.toUpperCase())], [collections]);
  const [filter, setFilter] = useState(validFilters.includes(initial) ? initial : "ALL");

  if (!ready) return null;

  const filtered =
    filter === "ALL" ? products : products.filter((p) => p.collection.toUpperCase() === filter);

  return (
    <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div className="aa-eyebrow">DROP 004</div>
        <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-2)" }}>
          SHOP ALL
        </h1>
        <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
          Five pieces. No restocks promised.
        </p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-8)" }}>
        <Button
          variant={filter === "ALL" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("ALL")}
        >
          ALL
        </Button>
        {collections.map((c) => (
          <Button
            key={c.handle}
            variant={filter === c.handle.toUpperCase() ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter(c.handle.toUpperCase())}
          >
            {c.title}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="aa-body" style={{ color: "var(--text-muted)", textAlign: "center" }}>
          No products in this category yet.
        </p>
      ) : (
        <div className="aa-grid">
          {filtered.map((p) => (
            <div key={p.handle} style={{ gridColumn: "span 4" }}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
