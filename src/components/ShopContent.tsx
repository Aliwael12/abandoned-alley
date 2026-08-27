"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { Button } from "./ui";
import ProductCard from "./ProductCard";

const CATEGORIES = [
  { value: "tees", label: "TEES" },
  { value: "sweats", label: "SWEATS" },
  { value: "accessories", label: "ACCESSORIES" },
];

export default function ShopContent({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const initial = searchParams.get("category")?.toLowerCase() ?? "all";
  const validFilters = useMemo(() => ["all", ...CATEGORIES.map((c) => c.value)], []);
  const [filter, setFilter] = useState(validFilters.includes(initial) ? initial : "all");

  const filtered = filter === "all" ? products : products.filter((p) => p.category === filter);

  return (
    <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-2)" }}>
          SHOP ALL
        </h1>
        <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
        </p>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-8)" }}>
        <Button
          variant={filter === "all" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          ALL
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c.value}
            variant={filter === c.value ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFilter(c.value)}
          >
            {c.label}
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
