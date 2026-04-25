"use client";

import { Product } from "@/lib/products";
import Image from "next/image";
import Link from "next/link";

export default function ProductCard({ product }: { product: Product }) {
  const firstImage = product.media.find((m) => m.type === "image");
  const cover = firstImage?.src ?? "";
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
            className="object-cover product-card-img"
          />
        )}
        <span className="absolute top-3 left-3 text-[10px] tracking-[0.25em] uppercase bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded">
          {product.vendor}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-bebas)] tracking-[0.12em] text-lg">
          {product.title}
        </h3>
        <p className="text-sm text-white/80">${product.price.toFixed(2)}</p>
      </div>
    </Link>
  );
}
