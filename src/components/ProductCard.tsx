"use client";

import { Product, Media } from "@/lib/products";
import { isProductSoldOut } from "@/lib/inventory";
import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const COLLAGE_LAYOUT = [
  { top: "0%", left: "0%", width: "58%", rotate: "-5deg", z: 1 },
  { top: "2%", left: "40%", width: "58%", rotate: "4deg", z: 2 },
  { top: "46%", left: "18%", width: "62%", rotate: "-2deg", z: 3 },
] as const;

function Chip({
  src,
  alt,
  layout,
  dim,
}: {
  src: string;
  alt: string;
  layout: (typeof COLLAGE_LAYOUT)[number];
  dim: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: layout.top,
        left: layout.left,
        width: layout.width,
        aspectRatio: "4 / 5",
        zIndex: layout.z,
        transform: `rotate(${layout.rotate})`,
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "0 6px 16px rgba(26,26,26,0.16)",
        overflow: "hidden",
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width:1024px) 15vw, (min-width:640px) 20vw, 30vw"
        style={{ objectFit: "cover", opacity: dim ? 0.5 : 1 }}
        unoptimized
      />
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const images = product.media.filter(
    (m): m is Extract<Media, { type: "image" }> => m.type === "image"
  );
  const soldOut = isProductSoldOut(product);
  const categoryLabel = product.collection.replace(/-/g, " ");

  return (
    <Link href={`/products/${product.handle}`} style={{ display: "block" }}>
      <Card interactive style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            aspectRatio: "4 / 5",
            background: "var(--surface-card-alt)",
            padding: "10%",
          }}
        >
          {images.length === 0 ? null : images.length === 1 ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <Image
                src={images[0].src}
                alt={product.title}
                fill
                sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
                style={{ objectFit: "cover", opacity: soldOut ? 0.5 : 1 }}
                unoptimized
              />
            </div>
          ) : (
            COLLAGE_LAYOUT.map((layout, i) => {
              const img = images[i % images.length];
              return (
                <Chip
                  key={i}
                  src={img.src}
                  alt={`${product.title} — view ${i + 1}`}
                  layout={layout}
                  dim={soldOut}
                />
              );
            })
          )}
        </div>
        <div style={{ padding: "var(--space-4) var(--space-5)" }}>
          <div className="aa-eyebrow">{categoryLabel}</div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-2)",
              marginTop: "var(--space-1)",
            }}
          >
            <h3 className="aa-display-h3">{product.title}</h3>
            {soldOut ? (
              <p className="aa-caption">Sold out</p>
            ) : (
              <p className="aa-price">EGP {product.price.toFixed(2)}</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
