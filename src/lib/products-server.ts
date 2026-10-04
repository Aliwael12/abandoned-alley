import { sql, withJson } from "@/lib/db";
import { products as STATIC_PRODUCTS, type Product } from "@/lib/products";
import { normalizeStock } from "@/lib/inventory";

/** A US price that isn't a usable number is absent, not zero — `null` included,
 *  which a bare `Number()` would otherwise turn into a real $0.00 price tag. */
function optionalPrice(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** A products row (or any product-shaped record) as a clean Product. */
export function normalizeProduct(raw: Record<string, unknown>): Product | null {
  if (!raw || typeof raw.handle !== "string") return null;
  return {
    handle: String(raw.handle),
    title: String(raw.title ?? ""),
    vendor: String(raw.vendor ?? "Abandoned Alley"),
    description: String(raw.description ?? ""),
    price: Number(raw.price ?? 0),
    priceUsd: optionalPrice(raw.priceUsd),
    media: Array.isArray(raw.media) ? (raw.media as Product["media"]) : [],
    options: Array.isArray(raw.options) ? (raw.options as Product["options"]) : [],
    // Variant prices are edited by hand and can arrive as strings or go
    // missing. Coerce them like the product-level price above: a variant price
    // that fails Number.isFinite is silently swallowed by the product-price
    // fallback in ProductDetail, which reads as "every size costs the same"
    // rather than as an error.
    variants: Array.isArray(raw.variants)
      ? (raw.variants as Product["variants"]).map((v) => ({
          ...v,
          price: Number(v.price ?? 0),
          priceUsd: optionalPrice(v.priceUsd),
        }))
      : [],
    collection: String(raw.collection ?? ""),
    disabled: Boolean(raw.disabled),
    stock: normalizeStock(raw.stock),
    stockUs: normalizeStock(raw.stockUs),
    sizeChartId:
      typeof raw.sizeChartId === "string" && raw.sizeChartId.trim()
        ? raw.sizeChartId.trim()
        : undefined,
    // optionalPrice, not Number(): a missing sort order is null in Postgres,
    // and Number(null) would put the product first instead of last.
    sortOrder: optionalPrice(raw.sortOrder),
    category:
      raw.category === "tees" || raw.category === "sweats" || raw.category === "accessories"
        ? raw.category
        : undefined,
    pairsWith: Array.isArray(raw.pairsWith)
      ? (raw.pairsWith as unknown[]).filter((h): h is string => typeof h === "string" && !!h)
      : undefined,
  };
}

/** Explicit sortOrder first (ascending); products without one sort after those that have it, alphabetically by title. */
function byDisplayOrder(a: Product, b: Product): number {
  if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
  if (a.sortOrder !== undefined) return -1;
  if (b.sortOrder !== undefined) return 1;
  return a.title.localeCompare(b.title);
}

/**
 * All products. Falls back to the bundled static catalog when the table is
 * empty (or unreachable) so the storefront keeps working out of the box.
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const rows = await sql`select * from products`;
    if (rows.length) {
      return rows
        .map((r) => normalizeProduct(r))
        .filter((p): p is Product => p !== null)
        .sort(byDisplayOrder);
    }
  } catch (err) {
    console.error("Products fetch failed, using static seed:", err);
  }
  return STATIC_PRODUCTS;
}

/** Public-facing listing: omits disabled items. */
export async function getActiveProducts(): Promise<Product[]> {
  return (await getAllProducts()).filter((p) => !p.disabled);
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  try {
    const [row] = await sql`select * from products where handle = ${handle}`;
    if (row) return normalizeProduct(row);
  } catch (err) {
    console.error("Product fetch failed:", err);
  }
  const fallback = STATIC_PRODUCTS.find((p) => p.handle === handle);
  return fallback ?? null;
}

/** Insert or fully replace a product. */
export async function upsertProduct(p: Product): Promise<void> {
  const row = withJson(
    sql,
    {
      handle: p.handle,
      title: p.title,
      vendor: p.vendor,
      description: p.description,
      price: p.price,
      priceUsd: p.priceUsd ?? null,
      media: p.media,
      options: p.options,
      variants: p.variants,
      collection: p.collection,
      disabled: Boolean(p.disabled),
      stock: p.stock ?? {},
      stockUs: p.stockUs ?? {},
      sizeChartId: p.sizeChartId ?? null,
      sortOrder: p.sortOrder ?? null,
      category: p.category ?? null,
      pairsWith: p.pairsWith ?? null,
      updatedAt: new Date(),
    },
    ["media", "options", "variants", "stock", "stockUs"]
  );
  await sql`
    insert into products ${sql(row)}
    on conflict (handle) do update set ${sql(row)}`;
}

export async function deleteProduct(handle: string): Promise<void> {
  await sql`delete from products where handle = ${handle}`;
}

/** Set `sizeChartId` on the given products; clear it on others that used this chart. */
export async function assignSizeChartToProducts(
  chartHandle: string,
  productHandles: string[]
): Promise<void> {
  const wanted = new Set(productHandles);
  const all = await getAllProducts();
  const updates = all.filter(
    (p) =>
      p.sizeChartId === chartHandle || wanted.has(p.handle)
  );
  for (const p of updates) {
    const nextId = wanted.has(p.handle) ? chartHandle : undefined;
    if (p.sizeChartId === nextId) continue;
    const next = { ...p, sizeChartId: nextId };
    if (!nextId) delete (next as { sizeChartId?: string }).sizeChartId;
    await upsertProduct(next);
  }
}
