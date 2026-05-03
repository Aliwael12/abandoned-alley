"use client";

import { type Product } from "@/lib/products";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

export default function SearchModal(props: {
  open: boolean;
  onClose: () => void;
}) {
  // Remount on open/close so internal query state resets without an effect.
  return <SearchModalInner key={props.open ? "open" : "closed"} {...props} />;
}

function SearchModalInner({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { products: Product[] }) => {
        if (!cancelled) setProducts(data.products);
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return products.slice(0, 6);
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.handle.includes(q)
    );
  }, [query, products]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-24 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl glass rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <Search size={18} className="text-white/60" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40"
              />
              <button onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 ? (
                <p className="p-8 text-center text-white/50">No results.</p>
              ) : (
                <ul>
                  {results.map((p) => {
                    const cover = p.media.find((m) => m.type === "image")?.src ?? "";
                    return (
                      <li key={p.handle}>
                        <Link
                          href={`/products/${p.handle}`}
                          onClick={onClose}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition"
                        >
                          <div className="relative w-12 h-14 bg-white/5 rounded-md overflow-hidden">
                            {cover && (
                              <Image
                                src={cover}
                                alt={p.title}
                                fill
                                className="object-cover"
                                sizes="48px"
                                unoptimized
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-[family-name:var(--font-bebas)] tracking-[0.1em] text-base">
                              {p.title}
                            </p>
                            <p className="text-xs text-white/50">{p.vendor}</p>
                          </div>
                          <p className="text-sm">EGP {p.price.toFixed(2)}</p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
