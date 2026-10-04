"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { pickCompleteTheFit } from "@/lib/complete-the-fit";
import { isSizeSoldOut, productSizes, sizeOfVariant } from "@/lib/inventory";
import { OFFER_COPY, type OfferConfig } from "@/lib/offer";
import { formatMoney, priceForRegion } from "@/lib/pricing";
import { useCatalog } from "@/lib/use-offer";
import { Button } from "./ui";

/**
 * One suggested piece under the spend-offer bar, in the cart drawer and on
 * /cart. Tapping Add shows the in-stock sizes inline; tapping a size adds it,
 * without leaving the cart. Hidden once the bag reaches the top tier. Egypt
 * only, like the offer it serves.
 */
export default function CompleteTheFit({ offer, subtotal }: { offer: OfferConfig; subtotal: number }) {
  const items = useCart((s) => s.items);
  const add = useCart((s) => s.add);
  const catalog = useCatalog(true);
  const [choosingFor, setChoosingFor] = useState<string | null>(null);

  const pick = pickCompleteTheFit({
    catalog,
    bagHandles: items.map((i) => i.productHandle),
    subtotal,
    offer,
    region: "eg",
  });
  if (!pick) return null;

  const { product, price } = pick;
  const choosing = choosingFor === product.handle;
  const image = product.media.find((m) => m.type === "image")?.src;
  const sizes = productSizes(product).filter((size) => !isSizeSoldOut(product, size, "eg"));
  const label =
    pick.unlocks === "discount"
      ? OFFER_COPY.fitUnlocksDiscount(offer)
      : pick.unlocks === "free_delivery"
      ? OFFER_COPY.fitUnlocksFreeDelivery
      : OFFER_COPY.fitGap(pick.gapAfter, offer);

  function addSize(size: string) {
    const variant = product.variants.find((v) => sizeOfVariant(v) === size);
    if (!variant) return;
    add({
      productHandle: product.handle,
      variantId: variant.id,
      title: product.title,
      variantTitle: variant.title,
      price: priceForRegion(variant, "eg") ?? price,
      image: image ?? "",
    });
    setChoosingFor(null);
  }

  return (
    <section className="aa-fit" aria-label={OFFER_COPY.fitTitle}>
      <div className="aa-eyebrow">{OFFER_COPY.fitTitle}</div>
      <div className="aa-fit-row">
        <div className="aa-fit-thumb">
          {image && <Image src={image} alt={product.title} fill sizes="56px" style={{ objectFit: "cover" }} unoptimized />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="aa-display-h3" style={{ fontSize: "var(--text-sm)" }}>{product.title}</p>
          <p className="aa-caption">{formatMoney(price, "eg")}</p>
          <p className="aa-caption" style={{ color: "var(--accent-default)" }}>{label}</p>
        </div>
        {!choosing && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setChoosingFor(product.handle)}
            aria-label={`Add ${product.title}`}
          >
            ADD
          </Button>
        )}
      </div>
      {choosing && (
        <div className="aa-fit-sizes" role="group" aria-label={`Choose a size for ${product.title}`}>
          {sizes.map((size) => (
            <Button key={size} type="button" variant="secondary" size="sm" onClick={() => addSize(size)}>
              {size}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setChoosingFor(null)}>
            CANCEL
          </Button>
        </div>
      )}
    </section>
  );
}
