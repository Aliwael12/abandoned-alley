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
    "title" | "description" | "price" | "disabled" | "media" | "sizeChartId"
  >
> & { image?: string; clearSizeChart?: boolean; stock?: StockMap };

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
    next.variants = next.variants.map((v) => ({ ...v, price: p }));
  }
  if (typeof body.disabled === "boolean") {
    next.disabled = body.disabled;
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
