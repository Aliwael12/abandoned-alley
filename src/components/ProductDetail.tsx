"use client";

import { Product } from "@/lib/products";
import type { SizeChart } from "@/lib/size-charts";
import { isProductSoldOut, isSizeSoldOut, stockForSize } from "@/lib/inventory";
import SizeChartPanel from "@/components/SizeChartPanel";
import ProductCard from "@/components/ProductCard";
import { useCart } from "@/lib/cart";
import { trackPixel, PIXEL_CURRENCY } from "@/lib/pixel";
import { Button, Badge } from "./ui";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ProductDetail({
  product,
  sizeChart,
  related = [],
}: {
  product: Product;
  sizeChart?: SizeChart | null;
  related?: Product[];
}) {
  const add = useCart((s) => s.add);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // The pin pack is the one product where a size ("Pack of 3"/"Pack of 5")
  // isn't the whole story — the shopper also picks which specific designs
  // fill it. Everything gated on `isPinProduct` below is that extra step.
  const isPinProduct = product.handle === "pin-pack";
  const [selectedPins, setSelectedPins] = useState<number[]>([]);

  const soldOut = useMemo(() => isProductSoldOut(product), [product]);
  const categoryLabel = product.collection.replace(/-/g, " ");

  const initialOptions = useMemo(() => {
    const o: Record<string, string> = {};
    for (const opt of product.options) {
      if (opt.name === "Size") {
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
  const selectedSizeSoldOut = !!selectedSize && isSizeSoldOut(product, selectedSize);
  const available = selectedSize ? stockForSize(product.stock, selectedSize) : 0;
  const pinPackCount = isPinProduct ? Number(selectedSize.replace(/\D/g, "")) || 0 : 0;

  function selectOption(name: string, value: string) {
    setSelected({ ...selected, [name]: value });
    if (name === "Size") {
      const avail = stockForSize(product.stock, value);
      if (avail > 0 && qty > avail) setQty(avail);
      // A different pack size means a different pin count to fill — start
      // over rather than carrying a stale, possibly-too-long selection.
      if (isPinProduct) setSelectedPins([]);
    }
  }

  function togglePin(i: number) {
    setSelectedPins((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= pinPackCount) return prev;
      return [...prev, i];
    });
  }

  const matchedVariant = useMemo(() => {
    return (
      product.variants.find((v) =>
        Object.entries(selected).every(([k, val]) => v.options[k] === val)
      ) ?? product.variants[0]
    );
  }, [selected, product.variants]);

  const coverImage = product.media.find((m) => m.type === "image")?.src ?? "";

  useEffect(() => {
    trackPixel("ViewContent", {
      content_ids: [product.handle],
      content_name: product.title,
      content_type: "product",
      value: matchedVariant.price,
      currency: PIXEL_CURRENCY,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.handle]);

  const onAdd = () => {
    if (soldOut || selectedSizeSoldOut) return;
    if (isPinProduct && selectedPins.length !== pinPackCount) return;
    if (available > 0 && qty > available) {
      setQty(available);
      return;
    }

    // Fold the chosen designs into the title (shown in cart/checkout/order
    // emails/admin) rather than variantTitle, which the stock-decrement path
    // reads verbatim as the size key ("Pack of 3") — encoding pin names into
    // it would break that lookup. The synthetic variantId keeps different
    // pin combos as separate cart lines instead of merging their quantities.
    let cartTitle = product.title;
    let cartImage = coverImage;
    let cartVariantId = matchedVariant.id;
    if (isPinProduct) {
      const chosenNames: string[] = [];
      for (const i of selectedPins) {
        const m = product.media[i];
        if (m.type === "image") {
          if (m.alt) chosenNames.push(m.alt);
          if (cartImage === coverImage) cartImage = m.src;
        }
      }
      if (chosenNames.length) cartTitle = `${product.title} — ${chosenNames.join(", ")}`;
      cartVariantId = `${matchedVariant.id}-${selectedPins.slice().sort((a, b) => a - b).join("-")}`;
    }

    add(
      {
        productHandle: product.handle,
        variantId: cartVariantId,
        title: cartTitle,
        variantTitle: matchedVariant.title,
        price: matchedVariant.price,
        image: cartImage,
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
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  // The pin pack's gallery is just its single cover collage — the other
  // media entries are pin designs for the picker below, not extra photos to
  // swipe through.
  const galleryMedia = isPinProduct ? product.media.slice(0, 1) : product.media;
  const activeMedia = galleryMedia[active] ?? galleryMedia[0];
  const hasMultipleMedia = galleryMedia.length > 1;
  const goPrev = () => setActive((i) => (i - 1 + galleryMedia.length) % galleryMedia.length);
  const goNext = () => setActive((i) => (i + 1) % galleryMedia.length);

  return (
    <div className="aa-container" style={{ padding: "var(--space-12) var(--space-6)" }}>
      <nav className="aa-caption" style={{ marginBottom: "var(--space-8)", display: "flex", gap: "var(--space-2)" }}>
        <span>SHOP</span>
        <span>/</span>
        <span>{categoryLabel}</span>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{product.title}</span>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-16)" }} className="aa-product-grid">
        {/* Gallery */}
        <div>
          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 5",
              background: "var(--surface-card-alt)",
              border: "1px solid var(--border-default)",
              overflow: "hidden",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0"
              >
                {activeMedia.type === "image" ? (
                  <Image
                    src={activeMedia.src}
                    alt={product.title}
                    fill
                    sizes="(min-width:1024px) 50vw, 100vw"
                    priority
                    style={{ objectFit: "cover" }}
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
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {hasMultipleMedia && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous image"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "var(--space-3)",
                    transform: "translateY(-50%)",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(255,255,255,0.85)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next image"
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: "var(--space-3)",
                    transform: "translateY(-50%)",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(255,255,255,0.85)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight size={20} />
                </button>
                <div
                  style={{
                    position: "absolute",
                    bottom: "var(--space-3)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 2,
                    display: "flex",
                    gap: "var(--space-2)",
                  }}
                >
                  {galleryMedia.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: i === active ? "var(--text-on-accent)" : "rgba(255,255,255,0.5)",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div className="aa-eyebrow">{categoryLabel}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <h1 className="aa-display-h1">{product.title}</h1>
            {soldOut && <Badge variant="accent">SOLD OUT</Badge>}
          </div>
          <p className="aa-price" style={{ fontSize: "var(--text-xl)" }}>
            EGP {matchedVariant.price.toFixed(2)}
          </p>
          <div style={{ height: 1, background: "var(--border-default)" }} />
          <p
            className="aa-body"
            style={{ color: "var(--text-muted)", maxWidth: 420, whiteSpace: "pre-line" }}
          >
            {product.description}
          </p>

          {sizeChart && <SizeChartPanel chart={sizeChart} />}

          {product.options.map((opt) => {
            const isSize = opt.name === "Size";
            return (
              <div key={opt.name} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div className="aa-eyebrow">{opt.name.toUpperCase()}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {opt.values.map((v) => {
                    const valueSoldOut = isSize && isSizeSoldOut(product, v);
                    const isSelected = selected[opt.name] === v;
                    return (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={isSelected ? "primary" : "secondary"}
                        disabled={valueSoldOut}
                        onClick={() => !valueSoldOut && selectOption(opt.name, v)}
                        title={valueSoldOut ? `${v} — sold out` : undefined}
                        style={valueSoldOut ? { textDecoration: "line-through" } : undefined}
                      >
                        {v}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {isPinProduct && selectedSize && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div className="aa-eyebrow">
                CHOOSE YOUR PINS ({selectedPins.length}/{pinPackCount})
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "var(--space-3)",
                }}
              >
                {product.media.map((m, i) => {
                  // Index 0 is the cover collage, not a selectable design.
                  if (i === 0 || m.type !== "image") return null;
                  const isChosen = selectedPins.includes(i);
                  const disable = !isChosen && selectedPins.length >= pinPackCount;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => togglePin(i)}
                      disabled={disable}
                      aria-pressed={isChosen}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        padding: "var(--space-2)",
                        border: isChosen
                          ? "2px solid var(--accent-default)"
                          : "1px solid var(--border-default)",
                        background: "var(--surface-card-alt)",
                        cursor: disable ? "not-allowed" : "pointer",
                        opacity: disable ? 0.4 : 1,
                      }}
                    >
                      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
                        <Image
                          src={m.src}
                          alt={m.alt ?? ""}
                          fill
                          sizes="120px"
                          style={{ objectFit: "contain" }}
                          unoptimized
                        />
                      </div>
                      <span className="aa-caption" style={{ textAlign: "center" }}>
                        {m.alt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!soldOut && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div className="aa-eyebrow">QTY</div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">
                  −
                </Button>
                <span className="aa-body" style={{ minWidth: 24, textAlign: "center" }}>{qty}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQty((q) => (available > 0 ? Math.min(available, q + 1) : q + 1))}
                  disabled={available > 0 && qty >= available}
                  aria-label="Increase quantity"
                >
                  +
                </Button>
                {available > 0 && available <= 5 && (
                  <span className="aa-caption" style={{ color: "var(--graphic-red)" }}>
                    Only {available} left
                  </span>
                )}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onAdd}
            disabled={
              soldOut ||
              selectedSizeSoldOut ||
              (isPinProduct && selectedPins.length !== pinPackCount)
            }
            style={{ width: "100%" }}
          >
            {soldOut || selectedSizeSoldOut
              ? "SOLD OUT"
              : isPinProduct && selectedPins.length !== pinPackCount
                ? `CHOOSE ${pinPackCount} PINS`
                : added
                  ? "ADDED ✓"
                  : "ADD TO BAG"}
          </Button>

          <div style={{ height: 1, background: "var(--border-subtle)" }} />
          <p className="aa-caption">
            {isPinProduct ? "CARE: Wipe clean, keep dry." : "CARE: Machine wash cold, hang dry."}
          </p>
          <p className="aa-caption">Ships from Cairo · Free returns within 14 days.</p>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ marginTop: "var(--space-24)" }}>
          <h2 className="aa-display-h2" style={{ marginBottom: "var(--space-8)" }}>
            YOU MIGHT ALSO LIKE
          </h2>
          <div className="aa-grid">
            {related.map((p) => (
              <div key={p.handle} style={{ gridColumn: "span 4" }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/shop" className="aa-nav-link" style={{ display: "inline-block", marginTop: "var(--space-8)" }}>
        ← BACK TO SHOP
      </Link>
    </div>
  );
}
