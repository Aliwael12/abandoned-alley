// Order lifecycle actions: approve, deliver, cancel. Each runs the stock-side
// effect atomically in a Postgres transaction that locks the order row (and
// any product rows it touches), then performs any external side effect
// (carrier dispatch) afterwards.
//
// Lifecycle (see src/lib/order-status.ts):
//   pending --approve--> approved  (deducts stock; dispatches to Droppin if
//                                     checkout's auto-push hadn't already)
//   approved --deliver--> delivered
//   pending/approved/delivered --cancel--> cancelled
//     (restores stock only if it had been deducted, i.e. was approved/delivered)
//   any open order --refund--> refunded (card orders are refunded in Stripe
//     first; they can't be plain-cancelled)

import { sql, withJson, type Db } from "@/lib/db";
import {
  normalizeStatus,
  isStockReserved,
  type OrderStatus,
} from "@/lib/order-status";
import { toRegion } from "@/lib/pricing";
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
import { refundCardPayment } from "@/lib/stripe-server";

/** Lock and read an order inside a transaction; throws if it doesn't exist. */
async function lockOrder(tx: Db, id: string): Promise<Record<string, unknown>> {
  const [order] = await tx`select * from orders where id = ${id} for update`;
  if (!order) throw new Error("Order not found.");
  return order;
}

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
  try {
    const committed = await sql.begin(async (tx) => {
      const order = await lockOrder(tx, id);

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
        await tx`update orders set status = 'approved', approved_at = now() where id = ${id}`;
        return { already: false as const };
      }

      const items = Array.isArray(order.items)
        ? (order.items as RawOrderItem[])
        : [];
      const reads = await readProductsForItems(tx, items, toRegion(order.region));
      const deductions = deductionsByProduct(items, reads.productByHandle);
      const shortfalls = findShortfalls(deductions, reads);
      if (shortfalls.length) {
        throw new Error(
          `Insufficient stock: ${shortfalls
            .map((f) => `${f.title} ${f.size} (need ${f.want}, have ${f.have})`)
            .join("; ")}`
        );
      }
      const stockDeducted = await writeDeductions(tx, deductions, reads);
      await tx`update orders set ${tx(
        withJson(tx, { status: "approved", approvedAt: new Date(), stockDeducted }, ["stockDeducted"])
      )} where id = ${id}`;
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
  try {
    await sql.begin(async (tx) => {
      const order = await lockOrder(tx, id);
      const status = normalizeStatus(order.status as string);
      if (status === "delivered") return; // idempotent
      if (status === "cancelled") throw new Error("Can't deliver a cancelled order.");
      // Delivering a still-pending order implicitly skips approval; that would
      // leave stock un-deducted, so require approval first.
      if (status === "pending") {
        throw new Error("Approve the order before marking it delivered.");
      }
      await tx`update orders set status = 'delivered', delivered_at = now() where id = ${id}`;
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
  try {
    await sql.begin(async (tx) => {
      const order = await lockOrder(tx, id);
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
        // Back into the store the units came out of: `region` is fixed when
        // the order is created, and orders that predate it were Egypt's.
        const reads = await readProductsForItems(tx, items, toRegion(order.region));
        await writeRestores(
          tx,
          recorded ?? deductionsByProduct(items, reads.productByHandle),
          reads
        );
      }

      await tx`update orders set ${tx({ status: to.status, [to.timestampField]: new Date() })} where id = ${id}`;
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
  // Cancelling would keep a card customer's money. Refund is the way to close
  // out an order paid through Stripe — it returns the payment as well.
  const order = await getOrderById(id);
  if (order?.payment.method === "card" && normalizeStatus(order.status) !== "cancelled") {
    return {
      ok: false,
      error: "This order was paid by card. Use Refund so the customer gets their money back.",
    };
  }
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
  // A card order gets its money back through Stripe first: if that fails, the
  // order stays as it was rather than reading "refunded" with nothing refunded.
  const order = await getOrderById(id);
  const paymentIntent = order?.payment.stripePaymentIntentId;
  let stripeRefundId: string | null = null;
  if (order && paymentIntent && normalizeStatus(order.status) !== "cancelled") {
    try {
      stripeRefundId = (await refundCardPayment(id, paymentIntent)).id;
    } catch (err) {
      return {
        ok: false,
        error: `Stripe refund failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const result = await closeOrder(
    id,
    { status: "refunded", timestampField: "refundedAt" },
    "Refund failed."
  );
  if (stripeRefundId) {
    if (!result.ok) {
      // The money is back with the customer; only our bookkeeping failed.
      // Retrying is safe — the Stripe refund is idempotent per order.
      return {
        ok: false,
        error: `The card was refunded in Stripe (${stripeRefundId}), but the order couldn't be updated: ${result.error} Try Refund again.`,
      };
    }
    await sql`update orders set stripe_refund_id = ${stripeRefundId} where id = ${id}`.catch((err) =>
      console.error(`Could not record Stripe refund ${stripeRefundId} on order ${id}:`, err)
    );
  }
  return result;
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
