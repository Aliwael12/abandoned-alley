// Order lifecycle actions: approve, deliver, cancel. Each runs the stock-side
// effect atomically via a Firestore transaction (client Web SDK runTransaction),
// then performs any external side effect (carrier dispatch) afterwards.
//
// Lifecycle (see src/lib/order-status.ts):
//   pending --approve--> approved  (deducts stock; dispatches metro -> Droppin)
//   approved --deliver--> delivered
//   pending/approved/delivered --cancel--> cancelled
//     (restores stock only if it had been deducted, i.e. was approved/delivered)

import {
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  normalizeStatus,
  isStockReserved,
  type OrderStatus,
} from "@/lib/order-status";
import { carrierForGovernorate } from "@/lib/order-status";
import { normalizeStock, sizeOfOrderItem } from "@/lib/inventory";
import type { Product, StockMap } from "@/lib/products";
import { getOrderById, pushOrderToDroppin } from "@/lib/orders-server";

export type ActionResult =
  | { ok: true; status: OrderStatus; dispatch?: { ok: boolean; error?: string } }
  | { ok: false; error: string };

type RawOrderItem = {
  productHandle?: string;
  variantId?: string;
  variantTitle?: string;
  quantity?: number;
};

/** Sum the ordered quantity per product handle, per size label. */
function deductionsByProduct(
  items: RawOrderItem[],
  productByHandle: Map<string, Product>
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const raw of items) {
    const handle = String(raw.productHandle ?? "");
    const qty = Math.max(0, Math.floor(Number(raw.quantity ?? 0)));
    if (!handle || qty <= 0) continue;
    const size = sizeOfOrderItem(
      {
        variantId: String(raw.variantId ?? ""),
        variantTitle: String(raw.variantTitle ?? ""),
      },
      productByHandle.get(handle)
    );
    if (!size) continue;
    const perSize = out.get(handle) ?? {};
    perSize[size] = (perSize[size] ?? 0) + qty;
    out.set(handle, perSize);
  }
  return out;
}

/**
 * Parse a recorded `stockDeducted` map ({ "handle::size": qty }) back into the
 * per-handle shape used for restoring. Returns null when there's nothing usable
 * (e.g. a legacy order approved before this field was tracked).
 */
function parseStockDeducted(
  raw: unknown
): Map<string, Record<string, number>> | null {
  if (!raw || typeof raw !== "object") return null;
  const out = new Map<string, Record<string, number>>();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const qty = Math.floor(Number(value));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const sep = key.lastIndexOf("::");
    if (sep <= 0) continue;
    const handle = key.slice(0, sep);
    const size = key.slice(sep + 2);
    if (!handle || !size) continue;
    const perSize = out.get(handle) ?? {};
    perSize[size] = (perSize[size] ?? 0) + qty;
    out.set(handle, perSize);
  }
  return out.size ? out : null;
}

function applyDelta(stock: StockMap, delta: Record<string, number>, sign: 1 | -1): StockMap {
  const next: StockMap = { ...stock };
  for (const [size, qty] of Object.entries(delta)) {
    const current = Number.isFinite(next[size]) ? next[size] : 0;
    next[size] = Math.max(0, current + sign * qty);
  }
  return next;
}

/**
 * Approve a pending order. Atomically verifies and deducts per-size stock; if
 * any size is short the whole approval is blocked with a message naming the
 * shortfalls. After committing, dispatches metro (Cairo/Giza) orders to Droppin.
 */
export async function approveOrder(id: string): Promise<ActionResult> {
  const orderRef = doc(db, "orders", id);

  try {
    const committed = await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found.");
      const order = orderSnap.data() as Record<string, unknown>;

      const status = normalizeStatus(order.status as string);
      if (status === "approved") {
        // Idempotent: already approved, nothing to do.
        return { already: true as const };
      }
      if (status !== "pending") {
        throw new Error(`Can't approve a ${status} order.`);
      }

      const items = Array.isArray(order.items)
        ? (order.items as RawOrderItem[])
        : [];

      // Read every referenced product first (all reads precede writes in a tx).
      const handles = Array.from(
        new Set(items.map((i) => String(i.productHandle ?? "")).filter(Boolean))
      );
      const productRefs = new Map<string, DocumentReference>(
        handles.map((h) => [h, doc(db, "products", h)])
      );
      const productByHandle = new Map<string, Product>();
      const stockByHandle = new Map<string, StockMap>();
      for (const [handle, ref] of productRefs) {
        const snap = await tx.get(ref);
        if (!snap.exists()) continue;
        const data = snap.data() as Product;
        productByHandle.set(handle, data);
        stockByHandle.set(handle, normalizeStock((data as { stock?: unknown }).stock));
      }

      const deductions = deductionsByProduct(items, productByHandle);

      // Verify sufficiency across all sizes before writing anything.
      const shortfalls: string[] = [];
      for (const [handle, perSize] of deductions) {
        const stock = stockByHandle.get(handle);
        const product = productByHandle.get(handle);
        const title = product?.title ?? handle;
        if (!stock) {
          shortfalls.push(`${title} (no stock record)`);
          continue;
        }
        for (const [size, want] of Object.entries(perSize)) {
          const have = Number.isFinite(stock[size]) ? stock[size] : 0;
          if (have < want) {
            shortfalls.push(`${title} ${size} (need ${want}, have ${have})`);
          }
        }
      }
      if (shortfalls.length) {
        throw new Error(`Insufficient stock: ${shortfalls.join("; ")}`);
      }

      // Deduct and write each product's stock, then flip the order to approved.
      // Record exactly what was deducted per handle::size so cancellation can
      // restore precisely that amount, even if the product's stock is later
      // edited independently.
      const stockDeducted: Record<string, number> = {};
      for (const [handle, perSize] of deductions) {
        const stock = stockByHandle.get(handle);
        if (!stock) continue;
        const nextStock = applyDelta(stock, perSize, -1);
        tx.update(productRefs.get(handle)!, { stock: nextStock });
        for (const [size, qty] of Object.entries(perSize)) {
          stockDeducted[`${handle}::${size}`] = qty;
        }
      }
      tx.update(orderRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        stockDeducted,
      });
      return { already: false as const };
    });

    if (committed.already) {
      return { ok: true, status: "approved" };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Approval failed.",
    };
  }

  // Stock is committed and the order is approved. Dispatch is a best-effort
  // side effect: a dispatch failure does not roll back the approval. Carrier is
  // derived from the destination governorate — only Cairo/Giza go to Droppin
  // here; everything else routes to ShipBlu, which isn't wired up yet.
  let dispatch: { ok: boolean; error?: string } | undefined;
  try {
    const order = await getOrderById(id);
    const carrier = order
      ? carrierForGovernorate(order.shipping.state)
      : "shipblu";
    if (carrier === "droppin") {
      const result = await pushOrderToDroppin(id);
      dispatch = result.ok ? { ok: true } : { ok: false, error: result.error };
    } else {
      // ShipBlu dispatch pending API integration — approved without a push.
      dispatch = { ok: false, error: "ShipBlu dispatch not yet available." };
    }
  } catch (err) {
    dispatch = {
      ok: false,
      error: err instanceof Error ? err.message : "Dispatch failed.",
    };
  }

  return { ok: true, status: "approved", dispatch };
}

/** Mark an order delivered. Allowed from approved (or already-delivered no-op). */
export async function deliverOrder(id: string): Promise<ActionResult> {
  const orderRef = doc(db, "orders", id);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error("Order not found.");
      const status = normalizeStatus(
        (snap.data() as Record<string, unknown>).status as string
      );
      if (status === "delivered") return; // idempotent
      if (status === "cancelled") throw new Error("Can't deliver a cancelled order.");
      // Delivering a still-pending order implicitly skips approval; that would
      // leave stock un-deducted, so require approval first.
      if (status === "pending") {
        throw new Error("Approve the order before marking it delivered.");
      }
      tx.update(orderRef, {
        status: "delivered",
        deliveredAt: serverTimestamp(),
      });
    });
    return { ok: true, status: "delivered" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not mark delivered.",
    };
  }
}

/**
 * Cancel an order. If it had already deducted stock (approved/delivered), the
 * stock is restored atomically. Cancelling a pending order changes no stock.
 */
export async function cancelOrder(id: string): Promise<ActionResult> {
  const orderRef = doc(db, "orders", id);
  try {
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found.");
      const order = orderSnap.data() as Record<string, unknown>;
      const status = normalizeStatus(order.status as string);
      if (status === "cancelled") return; // idempotent

      const restore = isStockReserved(order.status as string);

      if (restore) {
        const items = Array.isArray(order.items)
          ? (order.items as RawOrderItem[])
          : [];
        const handles = Array.from(
          new Set(items.map((i) => String(i.productHandle ?? "")).filter(Boolean))
        );
        const productRefs = new Map<string, DocumentReference>(
          handles.map((h) => [h, doc(db, "products", h)])
        );
        const productByHandle = new Map<string, Product>();
        const stockByHandle = new Map<string, StockMap>();
        for (const [handle, ref] of productRefs) {
          const snap = await tx.get(ref);
          if (!snap.exists()) continue;
          const data = snap.data() as Product;
          productByHandle.set(handle, data);
          stockByHandle.set(handle, normalizeStock((data as { stock?: unknown }).stock));
        }

        // Prefer the exact amount recorded at approval (handle::size -> qty).
        // Fall back to re-deriving from ordered quantity only for legacy orders
        // approved before stockDeducted was tracked.
        const recorded = parseStockDeducted(order.stockDeducted);
        const restoreBy = recorded ?? deductionsByProduct(items, productByHandle);
        for (const [handle, perSize] of restoreBy) {
          const stock = stockByHandle.get(handle);
          if (!stock) continue;
          const nextStock = applyDelta(stock, perSize, 1);
          tx.update(productRefs.get(handle)!, { stock: nextStock });
        }
      }

      tx.update(orderRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      });
    });
    return { ok: true, status: "cancelled" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Cancel failed.",
    };
  }
}

export type OrderAction = "approve" | "deliver" | "cancel";

export async function runOrderAction(
  action: OrderAction,
  id: string
): Promise<ActionResult> {
  switch (action) {
    case "approve":
      return approveOrder(id);
    case "deliver":
      return deliverOrder(id);
    case "cancel":
      return cancelOrder(id);
    default:
      return { ok: false, error: "Unknown action." };
  }
}
