"use client";

// Client-side access to the spend offer and the catalog, each fetched at most
// once per page load and shared by every component that asks (banner, product
// line, cart drawer, /cart).

import { useEffect, useState } from "react";
import { isOfferLive, type OfferConfig } from "@/lib/offer";
import type { Product } from "@/lib/products";
import { useHydrated, useRegion } from "@/lib/region";

let offerRequest: Promise<OfferConfig | null> | null = null;
let catalogRequest: Promise<Product[]> | null = null;

function loadOffer(): Promise<OfferConfig | null> {
  offerRequest ??= fetch("/api/offer", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { offer: OfferConfig | null } | null) => data?.offer ?? null)
    .catch(() => null);
  return offerRequest;
}

function loadCatalog(): Promise<Product[]> {
  catalogRequest ??= fetch("/api/products", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { products: Product[] } | null) => data?.products ?? [])
    .catch(() => []);
  return catalogRequest;
}

/**
 * The spend offer when it applies to this shopper right now: running, and the
 * Egypt store is the one they're in. Null otherwise — and until the region is
 * known in the browser, so a US shopper never sees it flash in.
 */
export function useLiveOffer(): OfferConfig | null {
  const hydrated = useHydrated();
  const region = useRegion((s) => s.region);
  const [offer, setOffer] = useState<OfferConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadOffer().then((o) => {
      if (!cancelled) setOffer(o);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!hydrated || region !== "eg" || !offer) return null;
  return isOfferLive(offer, "eg") ? offer : null;
}

/** Every active product, once `enabled` (so pages without the offer skip the fetch). */
export function useCatalog(enabled: boolean): Product[] {
  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadCatalog().then((products) => {
      if (!cancelled) setCatalog(products);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return catalog;
}
