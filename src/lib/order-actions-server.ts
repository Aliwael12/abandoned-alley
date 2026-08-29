// Order lifecycle actions: approve, deliver, cancel. Each runs the stock-side
// effect atomically via a Firestore transaction (client Web SDK runTransaction),
// then performs any external side effect (carrier dispatch) afterwards.
//
// Lifecycle (see src/lib/order-status.ts):
//   pending --approve--> approved  (deducts stock; dispatches to Droppin if
//                                     checkout's auto-push hadn't already)
//   approved --deliver--> delivered
//   pending/approved/delivered --cancel--> cancelled
//     (restores stock only if it had been deducted, i.e. was approved/delivered)

import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  normalizeStatus,
  isStockReserved,
  type OrderStatus,
} from "@/lib/order-status";
import {
  deductionsByProduct,
  findShortfalls,
  parseStockDeducted,
  readProductsForItems,
  writeDeductions,
  writeRestores,
  type RawOrderItem,
} from "@/lib/stock-reservation";
import { getOrderById, pushOrderToDroppin } from "@/lib/orders-server";

export type ActionResult =
  | {
      ok: true;
      // "refunded" is a distinct stored status that normalizes to "cancelled".
      status: OrderStatus | "refunded";
      dispatch?: { ok: boolean; error?: string };
    }
  | { ok: false; error: string };

/**
 * Approve a pending order. Atomically verifies and deducts per-size stock; if
 * any size is short the whole approval is blocked with a message naming the
 * shortfalls. After committing, dispatches to Droppin any order that checkout's
 * auto-push did not already place.
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

      // Stock is reserved at CHECKOUT now, so the normal case is that this
      // order already holds its stock and approval is a pure status flip.
      // Gating on `stockDeducted` is what stops approval from deducting a
      // second time; only a legacy order placed before checkout reserved stock
      // still needs to deduct here.
      if (parseStockDeducted(order.stockDeducted) !== null) {
        tx.update(orderRef, {
          status: "approved",
          approvedAt: serverTimestamp(),
        });
        return { already: false as const };
      }

      const items = Array.isArray(order.items)
        ? (order.items as RawOrderItem[])
        : [];
      const reads = await readProductsForItems(tx, items);
      const deductions = deductionsByProduct(items, reads.productByHandle);
      const shortfalls = findShortfalls(deductions, reads);
      if (shortfalls.length) {
        throw new Error(
          `Insufficient stock: ${shortfalls
            .map((f) => `${f.title} ${f.size} (need ${f.want}, have ${f.have})`)
            .join("; ")}`
        );
      }
      const stockDeducted = writeDeductions(tx, deductions, reads);
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
  // side effect: a dispatch failure does not roll back the approval. Every order
  // ships with Droppin.
  //
  // Egypt orders are normally already on Droppin — checkout dispatches them the
  // moment they are placed (see src/app/api/checkout/route.ts). Re-pushing would
  // come back as "Order is already on Droppin", surfacing a bogus dispatch error
  // in the admin UI, so treat an existing tracking number as a dispatch success.
  // This path still matters for orders whose auto-push failed at checkout.
  let dispatch: { ok: boolean; error?: string } | undefined;
  try {
    const existing = await getOrderById(id);
    if (existing?.droppin.trackingNumber) {
      return { ok: true, status: "approved", dispatch: { ok: true } };
    }
    const result = await pushOrderToDroppin(id);
    dispatch = result.ok ? { ok: true } : { ok: false, error: result.error };
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
 * Close out an order to a terminal state (cancelled or refunded), restoring any
 * stock that had already been deducted. Cancel and refund are the same stock
 * operation — they differ only in the status persisted and the meaning to the
 * merchant (a refund returns the customer's money), so they share this body.
 *
 * The write is idempotent: once the order already normalizes to cancelled
 * (which includes "refunded"), it is left untouched so stock can never be
 * restored twice. Restoring a still-pending order is a no-op because its stock
 * was never deducted.
 */
async function closeOrder(
  id: string,
  to: { status: "cancelled" | "refunded"; timestampField: string },
  failMessage: string
): Promise<ActionResult> {
  const orderRef = doc(db, "orders", id);
  try {
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found.");
      const order = orderSnap.data() as Record<string, unknown>;
      const status = normalizeStatus(order.status as string);
      if (status === "cancelled") return; // idempotent (covers refunded too)

      // Stock is held from checkout now, so a PENDING order can hold stock
      // too — what to restore can no longer be decided from status alone.
      // `stockDeducted` is the authority; re-deriving from the line items is a
      // fallback only for legacy approved/delivered orders placed before that
      // field existed. A legacy pending order (no record, never approved) has
      // nothing to give back, and correctly restores nothing.
      const recorded = parseStockDeducted(order.stockDeducted);
      const restore = recorded !== null || isStockReserved(order.status as string);

      if (restore) {
        const items = Array.isArray(order.items)
          ? (order.items as RawOrderItem[])
          : [];
        const reads = await readProductsForItems(tx, items);
        writeRestores(
          tx,
          recorded ?? deductionsByProduct(items, reads.productByHandle),
          reads
        );
      }

      tx.update(orderRef, {
        status: to.status,
        [to.timestampField]: serverTimestamp(),
      });
    });
    return { ok: true, status: to.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : failMessage,
    };
  }
}

/**
 * Cancel an order. If it had already deducted stock (approved/delivered), the
 * stock is restored atomically. Cancelling a pending order changes no stock.
 */
export async function cancelOrder(id: string): Promise<ActionResult> {
  return closeOrder(
    id,
    { status: "cancelled", timestampField: "cancelledAt" },
    "Cancel failed."
  );
}

/**
 * Refund an order: mark it refunded and restore stock. Stock was deducted at
 * approval, so refunding an approved/delivered order returns each ordered
 * product+size back to inventory (the same restock as cancellation). Refunding
 * a pending order — which never deducted stock — only flips the status.
 */
export async function refundOrder(id: string): Promise<ActionResult> {
  return closeOrder(
    id,
    { status: "refunded", timestampField: "refundedAt" },
    "Refund failed."
  );
}

export type OrderAction = "approve" | "deliver" | "cancel" | "refund";

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
    case "refund":
      return refundOrder(id);
    default:
      return { ok: false, error: "Unknown action." };
  }
}
