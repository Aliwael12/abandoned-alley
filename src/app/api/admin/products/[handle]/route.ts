import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  deleteProduct,
  getProductByHandle,
  upsertProduct,
} from "@/lib/products-server";
import { normalizeStock, productSizes } from "@/lib/inventory";
import type { Media, Product, StockMap } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Patch = Partial<
  Pick<
    Product,
    "title" | "description" | "price" | "disabled" | "media" | "sizeChartId" | "sortOrder"
  >
> & {
  image?: string;
  clearSizeChart?: boolean;
  stock?: StockMap;
  /** US price in USD; null/"" clears it and removes the product from the US store. */
  priceUsd?: number | string | null;
  /** Per-variant EGP prices, keyed by variant id. Overrides the flat `price`. */
  variantPrices?: Record<string, number | string | null>;
  /** Per-variant USD prices, keyed by variant id. Overrides the flat `priceUsd`. */
  variantPricesUsd?: Record<string, number | string | null>;
};

function sanitizeMedia(raw: unknown): Media[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Media[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const e = entry as Record<string, unknown>;
    const type = e.type;
    const src = typeof e.src === "string" ? e.src.trim() : "";
    if (!src) return null;
    if (type === "image") {
      out.push({
        type: "image",
        src,
        alt: typeof e.alt === "string" ? e.alt : undefined,
      });
    } else if (type === "video") {
      out.push({
        type: "video",
        src,
        poster: typeof e.poster === "string" ? e.poster : undefined,
      });
    } else {
      return null;
    }
  }
  return out;
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;

  let body: Patch;
  try {
    body = (await request.json()) as Patch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await getProductByHandle(handle);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next: Product = { ...existing };

  if (typeof body.title === "string" && body.title.trim()) {
    next.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    next.description = body.description.trim();
  }
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
    next.price = p;
    // Mirroring one number onto every variant is only right when the product
    // has one price to give. Multi-variant products are priced per variant
    // below, and the editor hides this flat field for them, so mirroring here
    // could only flatten prices the admin never meant to touch — which is how
    // the pin pack's "Pack of 5" silently ended up matching its "Pack of 3".
    if (next.variants.length <= 1) {
      next.variants = next.variants.map((v) => ({ ...v, price: p }));
    }
  }
  // US price, in USD — independent of the EGP price, not a conversion. Empty
  // string / null clears it, which takes the product out of the US store.
  if (body.priceUsd !== undefined) {
    if (body.priceUsd === null || body.priceUsd === "") {
      delete next.priceUsd;
      next.variants = next.variants.map((v) => {
        const rest = { ...v };
        delete rest.priceUsd;
        return rest;
      });
    } else {
      const usd = Number(body.priceUsd);
      if (!Number.isFinite(usd) || usd < 0) {
        return NextResponse.json({ error: "Invalid priceUsd" }, { status: 400 });
      }
      next.priceUsd = usd;
      // Same guard as the EGP mirror above. The clear branch stays
      // unconditional on purpose: dropping the US price has to strip it from
      // every variant, or the product vanishes from the US listing while its
      // detail page still quotes a price.
      if (next.variants.length <= 1) {
        next.variants = next.variants.map((v) => ({ ...v, priceUsd: usd }));
      }
    }
  }
  // Per-variant overrides. A product whose sizes cost different amounts — the
  // pin pack's "Pack of 3" vs "Pack of 5" — cannot be expressed by the flat
  // price above, which mirrors one number onto every variant and so silently
  // flattens them. These run after it, so sending both still lands per-variant.
  const badPrice = (raw: number | string | null | undefined) => {
    const n = Number(raw);
    return !Number.isFinite(n) || n < 0;
  };

  if (body.variantPrices) {
    for (const [id, raw] of Object.entries(body.variantPrices)) {
      if (raw === null || raw === "") continue;
      if (badPrice(raw)) {
        return NextResponse.json(
          { error: `Invalid price for variant ${id}` },
          { status: 400 }
        );
      }
    }
    next.variants = next.variants.map((v) => {
      const raw = body.variantPrices?.[v.id];
      if (raw === undefined || raw === null || raw === "") return v;
      return { ...v, price: Number(raw) };
    });
  }

  if (body.variantPricesUsd) {
    for (const [id, raw] of Object.entries(body.variantPricesUsd)) {
      if (raw === null || raw === "") continue;
      if (badPrice(raw)) {
        return NextResponse.json(
          { error: `Invalid USD price for variant ${id}` },
          { status: 400 }
        );
      }
    }
    next.variants = next.variants.map((v) => {
      const raw = body.variantPricesUsd?.[v.id];
      if (raw === undefined) return v;
      const cleared = raw === null || raw === "";
      const rest = { ...v };
      if (cleared) {
        delete rest.priceUsd;
        return rest;
      }
      return { ...rest, priceUsd: Number(raw) };
    });
  }

  // The product-level price is what listing cards show, so keep it as the entry
  // price — the cheapest variant — rather than letting it drift from them.
  if (body.variantPrices || body.variantPricesUsd) {
    const egp = next.variants.map((v) => v.price).filter((n) => Number.isFinite(n));
    if (egp.length) next.price = Math.min(...egp);

    const usd = next.variants
      .map((v) => v.priceUsd)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (usd.length) next.priceUsd = Math.min(...usd);
    else delete next.priceUsd;
  }

  if (typeof body.disabled === "boolean") {
    next.disabled = body.disabled;
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid sortOrder" }, { status: 400 });
    }
    next.sortOrder = n;
  }
  if (body.media !== undefined) {
    const cleaned = sanitizeMedia(body.media);
    if (cleaned === null) {
      return NextResponse.json({ error: "Invalid media entries" }, { status: 400 });
    }
    next.media = cleaned;
  } else if (typeof body.image === "string" && body.image.trim()) {
    next.media = [{ type: "image", src: body.image.trim(), alt: next.title }];
  }
  if (body.clearSizeChart) {
    delete next.sizeChartId;
  } else if (typeof body.sizeChartId === "string") {
    const id = body.sizeChartId.trim();
    if (id) next.sizeChartId = id;
    else delete next.sizeChartId;
  }
  if (body.stock !== undefined) {
    const cleaned = normalizeStock(body.stock);
    // Only keep counts for sizes this product actually sells, and ensure every
    // size has an explicit entry (missing -> 0).
    const sizes = productSizes(next);
    const stock: StockMap = {};
    for (const size of sizes) stock[size] = cleaned[size] ?? 0;
    next.stock = stock;
  }

  try {
    await upsertProduct(next);
  } catch (err) {
    console.error("Update product error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, product: next });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;
  try {
    await deleteProduct(handle);
  } catch (err) {
    console.error("Delete product error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
