"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Region = "us" | "eg";

type RegionState = {
  region: Region | null;
  setRegion: (r: Region) => void;
};

export const useRegion = create<RegionState>()(
  persist(
    (set) => ({
      region: null,
      setRegion: (r) => set({ region: r }),
    }),
    { name: "aa-region" }
  )
);

export function regionLabel(region: Region | null): string {
  return region === "us" ? "NY · USD" : "CAIRO · EGP";
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
      router.replace("/region");
    }
  }, [hydrated, region, router]);

  return { region, ready: hydrated && !!region };
}
