import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  deleteCollection,
  getCollectionByHandle,
  upsertCollection,
  type CollectionMeta,
} from "@/lib/collections-server";
import { getAllProducts } from "@/lib/products-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Patch = Partial<Pick<CollectionMeta, "title" | "image" | "description">>;

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

  const existing = await getCollectionByHandle(handle);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next: CollectionMeta = { ...existing };
  if (typeof body.title === "string" && body.title.trim()) {
    next.title = body.title.trim();
  }
  if (typeof body.image === "string") {
    next.image = body.image.trim();
  }
  if (typeof body.description === "string") {
    next.description = body.description.trim() || undefined;
  }

  try {
    await upsertCollection(next);
  } catch (err) {
    console.error("Update collection error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, collection: next });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;

  const products = await getAllProducts();
  const productCount = products.filter((p) => p.collection === handle).length;

  try {
    await deleteCollection(handle);
  } catch (err) {
    console.error("Delete collection error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, productCount });
}
