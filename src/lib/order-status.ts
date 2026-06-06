// Canonical order lifecycle + carrier routing, shared by the admin UI and the
// order-action API routes. Kept dependency-free so it can be imported from both
// client components and server routes.

import { METRO_GOVERNORATES, type EgyptGovernorate } from "@/lib/shipping";

/**
 * The order lifecycle:
 *   pending   — default at checkout; awaiting admin review.
 *   approved  — admin confirmed; stock deducted and (for metro) dispatched.
 *   delivered — fulfilled; counts toward realized revenue.
 *   cancelled — voided; stock restored if it was previously approved.
 */
export const ORDER_STATUSES = [
  "pending",
  "approved",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Older / external statuses (e.g. a Droppin webhook writing "fulfilled" or
 * "refunded") map onto our four canonical states so the dashboard stays
 * consistent regardless of where the status came from.
 */
const DELIVERED_ALIASES = new Set([
  "delivered",
  "completed",
  "fulfilled",
  "shipped",
]);
const CANCELLED_ALIASES = new Set([
  "cancelled",
  "canceled",
  "refunded",
  "returned",
  "failed",
  "void",
]);
const APPROVED_ALIASES = new Set(["approved", "confirmed", "processing"]);

/** Normalize any raw status string to one of the four canonical statuses. */
export function normalizeStatus(raw: string | null | undefined): OrderStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (DELIVERED_ALIASES.has(s)) return "delivered";
  if (CANCELLED_ALIASES.has(s)) return "cancelled";
  if (APPROVED_ALIASES.has(s)) return "approved";
  return "pending";
}

export function isDeliveredStatus(raw: string | null | undefined): boolean {
  return normalizeStatus(raw) === "delivered";
}

export function isCancelledStatus(raw: string | null | undefined): boolean {
  return normalizeStatus(raw) === "cancelled";
}

/** A status that has already had its stock deducted (approval happened). */
export function isStockReserved(raw: string | null | undefined): boolean {
  const s = normalizeStatus(raw);
  return s === "approved" || s === "delivered";
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// ---------------------------------------------------------------------------
// Carrier routing
// ---------------------------------------------------------------------------

export type Carrier = "droppin" | "shipblu";

export const CARRIER_LABEL: Record<Carrier, string> = {
  droppin: "Droppin",
  shipblu: "ShipBlu",
};

/**
 * Carrier is derived purely from the destination governorate:
 *   Cairo / Giza  -> Droppin
 *   everywhere else in Egypt -> ShipBlu
 * (ShipBlu dispatch isn't wired up yet — this only classifies the row.)
 */
export function carrierForGovernorate(state: string): Carrier {
  const g = state.trim();
  return (METRO_GOVERNORATES as readonly string[]).includes(g)
    ? "droppin"
    : "shipblu";
}

export function isMetroGovernorate(state: string): state is EgyptGovernorate {
  return (METRO_GOVERNORATES as readonly string[]).includes(state.trim());
}
