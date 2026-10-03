"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCart } from "@/lib/cart";
import { COUNTRY_COOKIE, countryName, regionForCountry } from "@/lib/geo";
import { REGION_CURRENCY, type Region } from "@/lib/pricing";

export type { Region };

type RegionState = {
  region: Region | null;
  /** The visitor's country as proxy.ts detected it, or null when the host
   * gives no geolocation (local dev). Re-read from the cookie on every page
   * load rather than persisted, so it follows the visitor around. */
  country: string | null;
  /** The shopper picked this store themselves (header switch or /region), so
   * location no longer overrides it on later page loads. Persisted. */
  chosen: boolean;
  setRegion: (r: Region) => void;
  /** A deliberate switch by the shopper: sticks across page loads. */
  chooseRegion: (r: Region) => void;
};

export const useRegion = create<RegionState>()(
  persist(
    (set, get) => ({
      region: null,
      country: null,
      chosen: false,
      setRegion: (r) => {
        // Prices are quoted per region in different currencies, and cart lines
        // store the price they were added at. Carrying them across a region
        // switch would mix EGP and USD in one basket, so the cart is dropped
        // whenever the region actually changes.
        const previous = get().region;
        if (previous && previous !== r) useCart.getState().clear();
        set({ region: r });
      },
      chooseRegion: (r) => {
        get().setRegion(r);
        set({ chosen: true });
      },
    }),
    { name: "aa-region", partialize: (s) => ({ region: s.region, chosen: s.chosen }) }
  )
);

/** Store visitors from countries neither store ships to browse: the US one,
 * whose USD prices read anywhere. */
const BROWSE_REGION: Region = "us";

function readCountryCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COUNTRY_COOKIE}=([A-Z]{2})(?:;|$)`));
  return match?.[1] ?? null;
}

/**
 * Location picks the store: Egypt gets the Egypt store, the US the New York
 * one. Anywhere else can browse but not buy — keeping whichever store they
 * already had, so a traveller's bag survives the trip, or the browse store if
 * this is their first visit. With no location the manual /region choice stands,
 * and a store the shopper switched to themselves always beats location.
 */
function applyLocation() {
  const country = readCountryCookie();
  if (!country) return;
  const { region, chosen, setRegion } = useRegion.getState();
  const local = regionForCountry(country);
  if (chosen && region) {
    // Keep their pick; just record where they are.
  } else if (local) setRegion(local);
  else if (!region) setRegion(BROWSE_REGION);
  useRegion.setState({ country });
}

// Once per page load, before anything renders, so no page flashes the wrong
// store or bounces through /region on the way in.
if (typeof document !== "undefined") applyLocation();

export function regionLabel(region: Region | null): string {
  return region === "us" ? "NY · USD" : "CAIRO · EGP";
}

/** The other store — there are exactly two. */
export function otherRegion(region: Region | null): Region {
  return region === "us" ? "eg" : "us";
}

/** The active region, defaulting to Egypt before the store hydrates. */
export function useRegionOrDefault(): Region {
  return useRegion((s) => s.region) ?? "eg";
}

/** Currency code for the active region, for pixel/analytics payloads. */
export function useRegionCurrency(): string {
  return REGION_CURRENCY[useRegionOrDefault()];
}

/** True when location decided the store, leaving nothing to choose on /region. */
export function useLocationDecides(): boolean {
  return useRegion((s) => s.country !== null);
}

/** Name of the visitor's country when neither store ships there — they can
 * browse, but not buy — otherwise null. */
export function useUnshippableCountry(): string | null {
  const country = useRegion((s) => s.country);
  return country && !regionForCountry(country) ? countryName(country) : null;
}

const noSubscription = () => () => {};

/** False while rendering on the server and hydrating, true after. The region
 * and location only exist in the browser, so UI outside the region gate that
 * depends on them waits for this rather than disagreeing with the server HTML. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
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
