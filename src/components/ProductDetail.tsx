"use client";

import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart";
import Image from "next/image";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Truck, RotateCcw, ShieldCheck, Play } from "lucide-react";
import Link from "next/link";

export default function ProductDetail({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);

  const initialOptions = useMemo(() => {
    const o: Record<string, string> = {};
    for (const opt of product.options) o[opt.name] = opt.values[0];
    return o;
  }, [product]);
  const [selected, setSelected] = useState<Record<string, string>>(initialOptions);

  const matchedVariant = useMemo(() => {
    return (
      product.variants.find((v) =>
        Object.entries(selected).every(([k, val]) => v.options[k] === val)
      ) ?? product.variants[0]
    );
  }, [selected, product.variants]);

  const coverImage = product.media.find((m) => m.type === "image")?.src ?? "";

  const onAdd = () => {
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
                />
                {m.type === "video" && (
                  <span className="absolute inset-0 grid place-items-center bg-black/30">
                    <Play size={16} className="text-white drop-shadow" />
                  </span>
                )}
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
            <p className="text-2xl">${matchedVariant.price.toFixed(2)}</p>
          </div>

          <p className="text-white/70 leading-relaxed max-w-md">
            {product.description}
          </p>

          {product.options.map((opt) => (
            <div key={opt.name} className="flex flex-col gap-3">
              <p className="text-xs tracking-[0.25em] uppercase text-white/60">
                {opt.name}: <span className="text-white">{selected[opt.name]}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {opt.values.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSelected({ ...selected, [opt.name]: v })}
                    className={`min-w-12 h-11 px-4 border rounded-md tracking-[0.1em] uppercase text-sm transition ${
                      selected[opt.name] === v
                        ? "border-white bg-white text-black"
                        : "border-white/20 text-white hover:border-white/60"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}

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
                onClick={() => setQty(qty + 1)}
                className="w-10 h-full grid place-items-center hover:bg-white/5"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={onAdd}
              className="flex-1 h-12 bg-white text-black rounded-md font-[family-name:var(--font-bebas)] tracking-[0.25em] uppercase hover:bg-white/90 transition"
            >
              Add to cart
            </button>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="h-12 border border-white/30 rounded-md font-[family-name:var(--font-bebas)] tracking-[0.25em] uppercase hover:bg-white/10 transition"
          >
            Buy it now
          </button>

          <ul className="grid grid-cols-3 gap-3 mt-2">
            <Feature icon={<Truck size={16} />} title="Free shipping" sub="Orders over $200" />
            <Feature icon={<RotateCcw size={16} />} title="14-day returns" sub="Easy & free" />
            <Feature
              icon={<ShieldCheck size={16} />}
              title="Secure checkout"
              sub="Protected payment"
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <li className="flex flex-col gap-1.5 p-3 rounded-md border border-white/10 bg-white/[0.03]">
      <span className="text-white/70">{icon}</span>
      <p className="text-sm">{title}</p>
      <p className="text-[11px] text-white/50">{sub}</p>
    </li>
  );
}
