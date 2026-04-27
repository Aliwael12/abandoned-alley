"use client";

import { useCart } from "@/lib/cart";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export default function CartDrawer() {
  const { isOpen, close, items, setQty, remove } = useCart();
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0a0a0a] border-l border-white/10 flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
                Cart ({items.length})
              </h2>
              <button onClick={close} aria-label="Close cart">
                <X size={20} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/60 gap-4 p-8">
                <p className="font-[family-name:var(--font-bebas)] tracking-[0.2em] text-lg">
                  Your cart is empty
                </p>
                <Link
                  href="/shop"
                  onClick={close}
                  className="px-6 py-3 border border-white/40 hover:border-white rounded-lg transition tracking-[0.2em] text-sm uppercase"
                >
                  Shop now
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
                  {items.map((item) => (
                    <div key={item.variantId} className="flex gap-4">
                      <div className="relative w-20 h-24 bg-white/5 rounded-md overflow-hidden shrink-0">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-[family-name:var(--font-bebas)] text-base tracking-[0.1em]">
                              {item.title}
                            </p>
                            <p className="text-xs text-white/50">{item.variantTitle}</p>
                          </div>
                          <button
                            onClick={() => remove(item.variantId)}
                            aria-label="Remove"
                            className="text-white/60 hover:text-[var(--accent)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center border border-white/15 rounded-md">
                            <button
                              className="w-7 h-7 grid place-items-center"
                              onClick={() => setQty(item.variantId, item.quantity - 1)}
                              aria-label="Decrease"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <button
                              className="w-7 h-7 grid place-items-center"
                              onClick={() => setQty(item.variantId, item.quantity + 1)}
                              aria-label="Increase"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <p className="text-sm">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 p-5 flex flex-col gap-3 bg-black/40">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 uppercase tracking-[0.2em] text-xs">Subtotal</span>
                    <span className="text-lg">${subtotal.toFixed(2)}</span>
                  </div>
                  <Link
                    href="/checkout"
                    onClick={close}
                    style={{ color: "#000" }}
                    className="w-full bg-white py-4 rounded-lg font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase hover:bg-white/90 transition text-center"
                  >
                    Checkout
                  </Link>
                  <p className="text-[11px] text-white/40 text-center">
                    Shipping & taxes calculated at checkout.
                  </p>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
