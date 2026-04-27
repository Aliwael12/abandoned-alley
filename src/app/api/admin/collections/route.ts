import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  createCollection,
  getAllCollections,
  getCollectionByHandle,
  type CollectionMeta,
} from "@/lib/collections-server";
import { getAllProducts } from "@/lib/products-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [collections, products] = await Promise.all([
    getAllCollections(),
    getAllProducts(),
  ]);
  const counts = new Map<string, number>();
  for (const p of products) {
    if (p.disabled) continue;
    counts.set(p.collection, (counts.get(p.collection) ?? 0) + 1);
  }
  const withCounts: CollectionMeta[] = collections.map((c) => ({
    ...c,
    count: counts.get(c.handle) ?? 0,
  }));
  return NextResponse.json({ collections: withCounts });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<CollectionMeta>;
  try {
    body = (await request.json()) as Partial<CollectionMeta>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const image = String(body.image ?? "").trim();
  const description = String(body.description ?? "").trim();
  const handleInput = String(body.handle ?? "").trim();

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const handle = slugify(handleInput || title);
  if (!handle) {
    return NextResponse.json({ error: "Could not derive handle" }, { status: 400 });
  }

  const existing = await getCollectionByHandle(handle);
  if (existing) {
    return NextResponse.json(
      { error: `Collection "${handle}" already exists` },
      { status: 409 }
    );
  }

  const meta: CollectionMeta = {
    handle,
    title,
    image,
    description: description || undefined,
  };

  try {
    await createCollection(meta);
  } catch (err) {
    console.error("Create collection error:", err);
    return NextResponse.json({ error: "Failed to save collection" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, collection: meta });
}
