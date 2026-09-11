"use client";

import { useHydrated, useUnshippableCountry } from "@/lib/region";

/** Strip telling visitors from a country neither store ships to that they can
 * look around but not order. Renders nothing for everyone else. */
export default function ShippingNotice() {
  const hydrated = useHydrated();
  const country = useUnshippableCountry();
  if (!hydrated || !country) return null;

  return (
    <div
      role="status"
      className="aa-caption"
      style={{
        position: "relative",
        zIndex: 1,
        background: "var(--accent-default)",
        color: "var(--text-on-accent)",
        textAlign: "center",
        padding: "var(--space-2) var(--space-4)",
      }}
    >
      We don&apos;t ship to {country} — but you can still browse.
    </div>
  );
}
