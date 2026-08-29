// Transactional per-size stock reservation, shared by checkout (which reserves
// stock as it creates the order) and the admin approval action (which reserves
// only for legacy orders placed before checkout did it).
//
// Stock is deducted at CHECKOUT, not at approval: an order is dispatched to
// Droppin the moment it is placed, so it must not be possible to place — and
// therefore ship — an order whose stock isn't there. Every order that holds
// stock records exactly what it took in `stockDeducted` ("handle::size" -> qty),
// which is the authority for restoring on cancel/refund.

import { doc, type DocumentReference, type Transaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeStock, sizeOfOrderItem } from "@/lib/inventory";
import type { Product, StockMap } from "@/lib/products";

export type RawOrderItem = {
  productHandle?: string;
  variantId?: string;
  variantTitle?: string;
  quantity?: number;
};

/** One size that can't be satisfied. `have` is what's actually on hand. */
export type Shortfall = { title: string; size: string; want: number; have: number };

/** Everything read from /products for an order's line items. */
export type ProductReads = {
  productRefs: Map<string, DocumentReference>;
  productByHandle: Map<string, Product>;
  stockByHandle: Map<string, StockMap>;
};

/** Thrown inside a transaction when stock can't cover the order. Callers
 * format their own message — the customer sees a different one than the admin. */
export class InsufficientStockError extends Error {
  readonly shortfalls: Shortfall[];
  constructor(shortfalls: Shortfall[]) {
    super(`Insufficient stock for ${shortfalls.length} size(s)`);
    this.name = "InsufficientStockError";
    this.shortfalls = shortfalls;
  }
}

/** Sum the ordered quantity per product handle, per size label. */
export function deductionsByProduct(
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
 * Read every product an order references. All reads must precede all writes in
 * a Firestore transaction, so callers run this first. A product doc that no
 * longer exists is simply absent from the maps, which `findShortfalls` reports
 * as zero stock — you can't sell what has no record.
 */
export async function readProductsForItems(
  tx: Transaction,
  items: RawOrderItem[]
): Promise<ProductReads> {
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
  return { productRefs, productByHandle, stockByHandle };
}

/** Every size the order asks for that stock can't cover. Empty means it fits. */
export function findShortfalls(
  deductions: Map<string, Record<string, number>>,
  reads: ProductReads
): Shortfall[] {
  const shortfalls: Shortfall[] = [];
  for (const [handle, perSize] of deductions) {
    const stock = reads.stockByHandle.get(handle);
    const title = reads.productByHandle.get(handle)?.title ?? handle;
    for (const [size, want] of Object.entries(perSize)) {
      const have = stock && Number.isFinite(stock[size]) ? stock[size] : 0;
      if (have < want) shortfalls.push({ title, size, want, have });
    }
  }
  return shortfalls;
}

export function applyDelta(
  stock: StockMap,
  delta: Record<string, number>,
  sign: 1 | -1
): StockMap {
  const next: StockMap = { ...stock };
  for (const [size, qty] of Object.entries(delta)) {
    const current = Number.isFinite(next[size]) ? next[size] : 0;
    next[size] = Math.max(0, current + sign * qty);
  }
  return next;
}

/**
 * Write the deductions and return the `handle::size -> qty` record to persist
 * on the order, so a later cancellation restores precisely what was taken even
 * if the product's stock is edited independently in the meantime.
 * Verify with `findShortfalls` before calling this.
 */
export function writeDeductions(
  tx: Transaction,
  deductions: Map<string, Record<string, number>>,
  reads: ProductReads
): Record<string, number> {
  const stockDeducted: Record<string, number> = {};
  for (const [handle, perSize] of deductions) {
    const stock = reads.stockByHandle.get(handle);
    if (!stock) continue;
    tx.update(reads.productRefs.get(handle)!, {
      stock: applyDelta(stock, perSize, -1),
    });
    for (const [size, qty] of Object.entries(perSize)) {
      stockDeducted[`${handle}::${size}`] = qty;
    }
  }
  return stockDeducted;
}

/** Put back what `restoreBy` says was taken. */
export function writeRestores(
  tx: Transaction,
  restoreBy: Map<string, Record<string, number>>,
  reads: ProductReads
): void {
  for (const [handle, perSize] of restoreBy) {
    const stock = reads.stockByHandle.get(handle);
    if (!stock) continue;
    tx.update(reads.productRefs.get(handle)!, {
      stock: applyDelta(stock, perSize, 1),
    });
  }
}

/**
 * Parse a recorded `stockDeducted` map back into the per-handle shape used for
 * restoring. Returns null when there's nothing usable — either the order never
 * held stock, or it's a legacy order approved before this field was tracked.
 */
export function parseStockDeducted(
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
