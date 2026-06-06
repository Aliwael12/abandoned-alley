"use client";

import { Product } from "@/lib/products";
import { isProductSoldOut } from "@/lib/inventory";
import Image from "next/image";
import Link from "next/link";

export default function ProductCard({ product }: { product: Product }) {
  const head = product.media[0];
  const coverEntry =
    head && head.type === "image" ? head : product.media.find((m) => m.type === "image");
  const cover = coverEntry?.src ?? "";
  const soldOut = isProductSoldOut(product);
  return (
    <Link
      href={`/products/${product.handle}`}
      className="product-card group flex flex-col"
    >
      <div className="relative aspect-[4/5] bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {cover && (
          <Image
            src={cover}
            alt={product.title}
            fill
            sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
            className={`object-cover product-card-img ${soldOut ? "opacity-50" : ""}`}
            unoptimized
          />
        )}
        {soldOut && (
          <span className="absolute top-3 left-3 px-2 py-1 text-[10px] tracking-[0.2em] uppercase bg-black/70 border border-white/20 rounded text-white/80">
            Sold out
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-bebas)] tracking-[0.12em] text-lg">
          {product.title}
        </h3>
        <p className="text-sm text-white/80">EGP {product.price.toFixed(2)}</p>
      </div>
    </Link>
  );
}
