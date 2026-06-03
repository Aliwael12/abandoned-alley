"use client";

// Centralized Meta Pixel (fbq) helper. The pixel itself is bootstrapped in
// src/app/layout.tsx, which also fires the initial `PageView`. Use trackPixel()
// from client components to report standard funnel events (ViewContent,
// AddToCart, InitiateCheckout, AddPaymentInfo, Purchase).

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const PIXEL_CURRENCY = "EGP";

/**
 * Fire a Meta standard event. No-ops safely on the server, or before the pixel
 * script has finished loading (fbq queues calls once it exists, so we only need
 * to guard against it being entirely absent).
 */
export function trackPixel(
  event: string,
  data?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  window.fbq("track", event, data);
}

export {};
