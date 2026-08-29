"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCart } from "@/lib/cart";
import { REGION_CURRENCY, type Region } from "@/lib/pricing";

export type { Region };

type RegionState = {
  region: Region | null;
  setRegion: (r: Region) => void;
};

export const useRegion = create<RegionState>()(
  persist(
    (set, get) => ({
      region: null,
      setRegion: (r) => {
        // Prices are quoted per region in different currencies, and cart lines
        // store the price they were added at. Carrying them across a region
        // switch would mix EGP and USD in one basket, so the cart is dropped
        // whenever the region actually changes.
        const previous = get().region;
        if (previous && previous !== r) useCart.getState().clear();
        set({ region: r });
      },
    }),
    { name: "aa-region" }
  )
);

export function regionLabel(region: Region | null): string {
  return region === "us" ? "NY · USD" : "CAIRO · EGP";
}

/** The active region, defaulting to Egypt before the store hydrates. */
export function useRegionOrDefault(): Region {
  return useRegion((s) => s.region) ?? "eg";
}

/** Currency code for the active region, for pixel/analytics payloads. */
export function useRegionCurrency(): string {
  return REGION_CURRENCY[useRegionOrDefault()];
}

/** Where the gate bounced the visitor from, so /region can send them back
 * there instead of dumping them on the landing page. sessionStorage (not a
 * query param) keeps /region a plain static client page — no useSearchParams,
 * so no Suspense boundary needed. */
const RETURN_KEY = "aa-region-return";

function rememberReturnPath(path: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    // Private mode / storage disabled — fall back to the landing page.
  }
}

/** Reads and clears the remembered path. Only same-origin absolute paths are
 * honoured, so a tampered value can't turn this into an open redirect. */
export function takeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
    return path;
  } catch {
    return null;
  }
}

/** Redirects to /region if no region has been chosen yet. Mirrors the design
 * handoff's per-page mount guard — every gated storefront page calls this. */
export function useRequireRegion() {
  const router = useRouter();
  const region = useRegion((s) => s.region);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated && !region) {
      rememberReturnPath(window.location.pathname + window.location.search);
      router.replace("/region");
    }
  }, [hydrated, region, router]);

  return { region, ready: hydrated && !!region };
}
