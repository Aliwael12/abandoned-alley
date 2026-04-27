import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getProductByHandle, upsertProduct } from "@/lib/products-server";
import type { Product } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ handle: string; productHandle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle, productHandle } = await ctx.params;

  const product = await getProductByHandle(productHandle);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (product.collection !== handle) {
    return NextResponse.json(
      { error: "Product is not in this collection" },
      { status: 400 }
    );
  }

  const next: Product = { ...product, collection: "" };
  try {
    await upsertProduct(next);
  } catch (err) {
    console.error("Unassign product error:", err);
    return NextResponse.json({ error: "Failed to unassign" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, product: next });
}
