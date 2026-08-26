"use client";

import type { ReactNode } from "react";
import { useRequireRegion } from "@/lib/region";

/** Wraps server-rendered page content and enforces the region gate client-side,
 * matching the design handoff's per-page mount guard. */
export default function RegionGate({ children }: { children: ReactNode }) {
  const { ready } = useRequireRegion();
  if (!ready) return null;
  return <>{children}</>;
}
