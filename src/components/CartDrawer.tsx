"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { Product } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { isProductSoldOut } from "@/lib/inventory";
import { formatMoney, isPricedForRegion } from "@/lib/pricing";
import { useRegionOrDefault } from "@/lib/region";
import ProductCard from "./ProductCard";
import { Button } from "./ui";

/** How many "you might also like" cards the drawer offers. */
const PICK_COUNT = 6;

/**
 * The phone add-to-bag drawer: slides in over the product page with the bag as
 * it now stands, the way to checkout, and more products to keep going with.
 * Portalled to <body> because <main> is its own stacking context beneath the
 * sticky header — a fixed layer inside it could never cover the header.
 */
export default function CartDrawer({
  open,
  onClose,
  suggestions,
  collectionTitles,
}: {
  open: boolean;
  onClose: () => void;
  /** Candidates for "you might also like". Anything already in the bag, sold
   *  out, or not priced in this region is skipped. */
  suggestions: Product[];
  /** collection handle -> display title, for the suggestion cards. */
  collectionTitles?: Record<string, string>;
}) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const region = useRegionOrDefault();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const inBag = new Set(items.map((i) => i.productHandle));
  const picks = suggestions
    .filter((p) => !inBag.has(p.handle) && isPricedForRegion(p, region) && !isProductSoldOut(p))
    .slice(0, PICK_COUNT);

  // While open: freeze the page behind, close on Escape, and hand focus back
  // to whatever opened the drawer (the add button) once it shuts.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          className="aa-drawer-scrim"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        />
      )}
      {open && (
        <motion.aside
          key="panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
          className="aa-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: reduceMotion ? 0 : 0.34, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="aa-drawer-head">
            <div>
              <div className="aa-eyebrow" style={{ color: "var(--accent-default)" }}>
                ADDED TO BAG ✓
              </div>
              <h2 id="cart-drawer-title" className="aa-display-h2" style={{ marginTop: "var(--space-1)" }}>
                YOUR BAG ({count})
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="aa-drawer-close"
              onClick={onClose}
              aria-label="Close bag"
            >
              <X size={22} />
            </button>
          </div>

          <div className="aa-drawer-body">
            {items.length === 0 ? (
              <p className="aa-body" style={{ color: "var(--text-muted)" }}>
                Your bag is empty.
              </p>
            ) : (
              <ul className="aa-card aa-drawer-lines">
                {items.map((item) => (
                  <li key={item.variantId} className="aa-drawer-line">
                    <div className="aa-drawer-thumb">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="64px"
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                    </div>
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <h3 className="aa-display-h3" style={{ fontSize: "var(--text-sm)" }}>
                        {item.title}
                      </h3>
                      <p className="aa-caption">{item.variantTitle}</p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "var(--space-2)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setQty(item.variantId, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.title}`}
                          >
                            −
                          </Button>
                          <span className="aa-body">{item.quantity}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setQty(item.variantId, item.quantity + 1)}
                            aria-label={`Increase quantity of ${item.title}`}
                          >
                            +
                          </Button>
                        </div>
                        <span className="aa-price">{formatMoney(item.price * item.quantity, region)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {picks.length > 0 && (
              <section aria-labelledby="cart-drawer-picks">
                <h3
                  id="cart-drawer-picks"
                  className="aa-display-h3"
                  style={{ marginBottom: "var(--space-4)" }}
                >
                  YOU MIGHT ALSO LIKE
                </h3>
                <div className="aa-drawer-picks">
                  {picks.map((p) => (
                    <div key={p.handle} className="aa-drawer-pick">
                      <ProductCard
                        product={p}
                        collectionTitle={collectionTitles?.[p.collection]}
                        onClick={onClose}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="aa-drawer-foot">
            {items.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span className="aa-caption">SUBTOTAL</span>
                  <span className="aa-price" style={{ fontSize: "var(--text-md)" }}>
                    {formatMoney(subtotal, region)}
                  </span>
                </div>
                <p className="aa-caption">Shipping calculated at checkout.</p>
                {/* Straight to the checkout form — the bag was just reviewed here. */}
                <Link
                  href="/cart?step=checkout"
                  onClick={onClose}
                  className="aa-btn aa-btn--primary aa-btn--lg"
                  style={{ width: "100%", color: "var(--text-on-accent)" }}
                >
                  CHECKOUT
                </Link>
              </>
            )}
            <Button type="button" variant="secondary" size="lg" onClick={onClose} style={{ width: "100%" }}>
              CONTINUE SHOPPING
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body
  );
}
