"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import type { CollectionMeta } from "@/lib/collections-server";
import { Button } from "./ui";
import ProductCard from "./ProductCard";

const CATEGORY_TINTS: Record<string, string> = {
  hoodies: "var(--tint-hoodies)",
  tees: "var(--tint-tees)",
  bottoms: "var(--tint-bottoms)",
  outerwear: "var(--tint-outerwear)",
  accessories: "var(--tint-accessories)",
};

export default function HomeContent({
  products,
  collections,
}: {
  products: Product[];
  collections: CollectionMeta[];
}) {
  const newArrivals = products.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-8)" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Image
            src="/media/hero-beard.webp"
            alt="Abandoned Alley — Drop 004"
            width={2000}
            height={3000}
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 160px)",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", justifyContent: "center", padding: "0 var(--space-6) var(--space-8)" }}>
          <Link href="/shop"><Button variant="primary" size="lg">SHOP ALL</Button></Link>
          <Link href="/shop?category=004"><Button variant="secondary" size="lg">SHOP DROP 004</Button></Link>
        </div>
      </section>

      {/* Collections */}
      <section
        id="collections"
        style={{ scrollMarginTop: 140, padding: "var(--space-16) var(--space-6)" }}
      >
        <div style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <div className="aa-eyebrow">SHOP BY CATEGORY</div>
          <h2 className="aa-display-h2" style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-8)" }}>
            COLLECTIONS
          </h2>
          <div className="aa-grid">
            {collections.map((c) => {
              const tint = CATEGORY_TINTS[c.title.toLowerCase()] ?? "var(--surface-card-alt)";
              return (
                <Link
                  key={c.handle}
                  href={`/collections/${c.handle}`}
                  style={{ gridColumn: "span 4" }}
                >
                  <div
                    className="aa-collection-tile"
                    style={{
                      aspectRatio: "4 / 5",
                      border: "1px solid var(--border-default)",
                      background: tint,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {c.image && (
                      <Image src={c.image} alt={c.title} fill style={{ objectFit: "cover" }} unoptimized />
                    )}
                  </div>
                  <h3 className="aa-display-h3" style={{ marginTop: "var(--space-3)" }}>
                    {c.title}
                  </h3>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section style={{ padding: "var(--space-16) var(--space-6)" }}>
          <div style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "var(--space-8)",
              }}
            >
              <h2 className="aa-display-h2">NEW ARRIVALS</h2>
              <Link href="/shop" style={{ color: "var(--accent-default)" }} className="aa-nav-link">
                VIEW ALL →
              </Link>
            </div>
            <div className="aa-grid">
              {newArrivals.map((p) => (
                <div key={p.handle} style={{ gridColumn: "span 4" }}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
