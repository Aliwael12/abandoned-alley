"use client";

import { Product } from "@/lib/products";
import type { SizeChart } from "@/lib/size-charts";
import { isProductSoldOut, isSizeSoldOut, stockForSize } from "@/lib/inventory";
import SizeChartPanel from "@/components/SizeChartPanel";
import { useCart } from "@/lib/cart";
import { trackPixel, PIXEL_CURRENCY } from "@/lib/pixel";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import Link from "next/link";

export default function ProductDetail({
  product,
  sizeChart,
}: {
  product: Product;
  sizeChart?: SizeChart | null;
}) {
  const add = useCart((s) => s.add);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);

  const soldOut = useMemo(() => isProductSoldOut(product), [product]);

  const initialOptions = useMemo(() => {
    const o: Record<string, string> = {};
    for (const opt of product.options) {
      if (opt.name === "Size") {
        // Prefer the first size that's actually in stock.
        const firstAvailable =
          opt.values.find((v) => !isSizeSoldOut(product, v)) ?? opt.values[0];
        o[opt.name] = firstAvailable;
      } else {
        o[opt.name] = opt.values[0];
      }
    }
    return o;
  }, [product]);
  const [selected, setSelected] = useState<Record<string, string>>(initialOptions);

  const selectedSize = selected["Size"] ?? "";
  const selectedSizeSoldOut =
    !!selectedSize && isSizeSoldOut(product, selectedSize);
  // Units available for the chosen size; caps the quantity stepper and add.
  const available = selectedSize ? stockForSize(product.stock, selectedSize) : 0;

  // Switch the selected size and, in the same event, pull the quantity down if
  // the new size has less stock than the current qty (kept out of an effect).
  function selectOption(name: string, value: string) {
    setSelected({ ...selected, [name]: value });
    if (name === "Size") {
      const avail = stockForSize(product.stock, value);
      if (avail > 0 && qty > avail) setQty(avail);
    }
  }

  const matchedVariant = useMemo(() => {
    return (
      product.variants.find((v) =>
        Object.entries(selected).every(([k, val]) => v.options[k] === val)
      ) ?? product.variants[0]
    );
  }, [selected, product.variants]);

  const coverImage = product.media.find((m) => m.type === "image")?.src ?? "";

  // ViewContent: fires once when the product detail page is opened.
  useEffect(() => {
    trackPixel("ViewContent", {
      content_ids: [product.handle],
      content_name: product.title,
      content_type: "product",
      value: matchedVariant.price,
      currency: PIXEL_CURRENCY,
    });
    // Intentionally keyed to the product only — we don't re-fire when the
    // shopper switches variant/size on the same product page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.handle]);

  const onAdd = () => {
    if (soldOut || selectedSizeSoldOut) return;
    // Never add more than what's in stock for this size.
    if (available > 0 && qty > available) {
      setQty(available);
      return;
    }
    add(
      {
        productHandle: product.handle,
        variantId: matchedVariant.id,
        title: product.title,
        variantTitle: matchedVariant.title,
        price: matchedVariant.price,
        image: coverImage,
      },
      qty
    );
    trackPixel("AddToCart", {
      content_ids: [matchedVariant.id],
      content_name: product.title,
      content_type: "product",
      contents: [{ id: matchedVariant.id, quantity: qty }],
      value: matchedVariant.price * qty,
      currency: PIXEL_CURRENCY,
    });
  };

  const activeMedia = product.media[active];

  return (
    <div className="max-w-[1300px] mx-auto px-4 md:px-8 py-12">
      <nav className="text-xs tracking-[0.2em] uppercase text-white/50 mb-8 flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-white">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-white">Shop</Link>
        <span>/</span>
        <Link href={`/collections/${product.collection}`} className="hover:text-white">
          DDW
        </Link>
        <span>/</span>
        <span className="text-white/80">{product.title}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div className="flex flex-col-reverse md:flex-row gap-4">
          <div className="flex md:flex-col gap-3 md:max-h-[640px] overflow-auto">
            {product.media.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={`relative w-20 h-24 rounded-md overflow-hidden border ${
                  active === i ? "border-white" : "border-white/15"
                } shrink-0`}
                aria-label={`View ${m.type} ${i + 1}`}
              >
                <Image
                  src={m.type === "image" ? m.src : m.poster ?? coverImage}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>

          <div className="relative flex-1 aspect-[4/5] rounded-2xl overflow-hidden bg-white/5 border border-white/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                {activeMedia.type === "image" ? (
                  <Image
                    src={activeMedia.src}
                    alt={product.title}
                    fill
                    sizes="(min-width:1024px) 50vw, 100vw"
                    priority
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <video
                    key={activeMedia.src}
                    src={activeMedia.src}
                    poster={activeMedia.poster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6 lg:py-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
              {product.vendor}
            </p>
            <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-5xl tracking-[0.12em] uppercase">
              {product.title}
            </h1>
            <p className="text-2xl">EGP {matchedVariant.price.toFixed(2)}</p>
          </div>

          <p className="text-white/70 leading-relaxed max-w-md">
            {product.description}
          </p>

          {sizeChart && <SizeChartPanel chart={sizeChart} />}

          {product.options.map((opt) => {
            const isSize = opt.name === "Size";
            return (
              <div key={opt.name} className="flex flex-col gap-3">
                <p className="text-xs tracking-[0.25em] uppercase text-white/60">
                  {opt.name}: <span className="text-white">{selected[opt.name]}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {opt.values.map((v) => {
                    const valueSoldOut = isSize && isSizeSoldOut(product, v);
                    const isSelected = selected[opt.name] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={valueSoldOut}
                        onClick={() => !valueSoldOut && selectOption(opt.name, v)}
                        title={valueSoldOut ? `${v} — sold out` : undefined}
                        className={`relative min-w-12 h-11 px-4 border rounded-md tracking-[0.1em] uppercase text-sm transition ${
                          valueSoldOut
                            ? "border-white/10 text-white/30 line-through cursor-not-allowed"
                            : isSelected
                              ? "border-white bg-white text-black"
                              : "border-white/20 text-white hover:border-white/60"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {soldOut ? (
            <div className="h-12 grid place-items-center border border-white/15 rounded-md font-[family-name:var(--font-bebas)] tracking-[0.25em] uppercase text-white/50">
              Sold out
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-white/20 rounded-md h-12">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-10 h-full grid place-items-center hover:bg-white/5"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center">{qty}</span>
                  <button
                    onClick={() => setQty((q) => (available > 0 ? Math.min(available, q + 1) : q + 1))}
                    disabled={available > 0 && qty >= available}
                    className="w-10 h-full grid place-items-center hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {available > 0 && available <= 5 && (
                  <span className="text-xs text-amber-300/90">
                    Only {available} left
                  </span>
                )}
                <button
                  type="button"
                  onClick={onAdd}
                  disabled={selectedSizeSoldOut}
                  className="flex-1 h-12 bg-white text-black rounded-md font-[family-name:var(--font-bebas)] tracking-[0.25em] uppercase hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedSizeSoldOut ? `${selectedSize} sold out` : "Add to cart"}
                </button>
              </div>
              <button
                type="button"
                onClick={onAdd}
                disabled={selectedSizeSoldOut}
                className="h-12 border border-white/30 rounded-md font-[family-name:var(--font-bebas)] tracking-[0.25em] uppercase hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Buy it now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
