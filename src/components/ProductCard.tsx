"use client";

import { Product } from "@/lib/products";
import { isProductSoldOut } from "@/lib/inventory";
import Image from "next/image";
import Link from "next/link";
import { Card, Badge } from "./ui";
import { useRegionOrDefault } from "@/lib/region";
import { formatMoney, priceForRegion } from "@/lib/pricing";

export default function ProductCard({
  product,
  collectionTitle,
}: {
  product: Product;
  /** Display name for product.collection. Falls back to the handle when the
   *  collection isn't known, so a card never renders blank. */
  collectionTitle?: string;
}) {
  const region = useRegionOrDefault();
  const price = priceForRegion(product, region);
  const head = product.media[0];
  const coverEntry =
    head && head.type === "image" ? head : product.media.find((m) => m.type === "image");
  const cover = coverEntry?.src ?? "";
  const soldOut = isProductSoldOut(product);
  const categoryLabel = collectionTitle ?? product.collection.replace(/-/g, " ");

  return (
    <Link href={`/products/${product.handle}`} style={{ display: "block" }}>
      <Card interactive style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", aspectRatio: "4 / 5", background: "var(--surface-card-alt)" }}>
          {cover && (
            <Image
              src={cover}
              alt={product.title}
              fill
              sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
              style={{ objectFit: "cover", opacity: soldOut ? 0.5 : 1 }}
              unoptimized
            />
          )}
          {soldOut && (
            <Badge
              variant="neutral"
              style={{ position: "absolute", top: "var(--space-3)", left: "var(--space-3)" }}
            >
              Sold out
            </Badge>
          )}
        </div>
        <div className="aa-card-body" style={{ padding: "var(--space-4) var(--space-5)" }}>
          <div className="aa-eyebrow">{categoryLabel}</div>
          <div className="aa-card-meta">
            <h3 className="aa-display-h3">{product.title}</h3>
            <p className="aa-price">
              {price === null ? "—" : formatMoney(price, region)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
