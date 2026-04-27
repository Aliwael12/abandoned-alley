import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  deleteProduct,
  getProductByHandle,
  upsertProduct,
} from "@/lib/products-server";
import type { Product } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Patch = Partial<
  Pick<Product, "title" | "description" | "price" | "disabled">
> & { image?: string };

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
  if (typeof body.image === "string" && body.image.trim()) {
    next.media = [{ type: "image", src: body.image.trim(), alt: next.title }];
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
