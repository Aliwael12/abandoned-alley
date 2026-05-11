"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function PurchaseTracker({
  orderId,
  value,
  currency,
}: {
  orderId: string;
  value: number;
  currency: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `aa_purchase_fired_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // proceed even if storage blocked
    }

    let tries = 0;
    const fire = () => {
      if (window.fbq) {
        window.fbq("track", "Purchase", {
          value,
          currency,
          content_ids: [orderId],
          content_type: "product",
        });
        return;
      }
      if (tries++ < 20) {
        setTimeout(fire, 200);
      }
    };
    fire();
  }, [orderId, value, currency]);

  return null;
}
