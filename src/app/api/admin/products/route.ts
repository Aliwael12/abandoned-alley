import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAllProducts, upsertProduct } from "@/lib/products-server";
import type { Product } from "@/lib/products";

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
  const products = await getAllProducts();
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<Product> & { image?: string };
  try {
    body = (await request.json()) as Partial<Product> & { image?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const price = Number(body.price);
  const collectionHandle = String(body.collection ?? "").trim() || "general";
  const image = String(body.image ?? "").trim();
  const handleInput = String(body.handle ?? "").trim();

  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0)
    return NextResponse.json({ error: "Valid price required" }, { status: 400 });

  const handle = slugify(handleInput || title);
  if (!handle) return NextResponse.json({ error: "Could not derive handle" }, { status: 400 });

  const product: Product = {
    handle,
    title,
    vendor: String(body.vendor ?? "Abandoned Alley"),
    collection: collectionHandle,
    description,
    price,
    media: image
      ? [{ type: "image", src: image, alt: title }]
      : [],
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
    variants: ["S", "M", "L", "XL"].map((sz) => ({
      id: `${handle}-${sz.toLowerCase()}`,
      title: sz,
      price,
      options: { Size: sz },
    })),
    disabled: Boolean(body.disabled),
  };

  try {
    await upsertProduct(product);
  } catch (err) {
    console.error("Create product error:", err);
    return NextResponse.json({ error: "Failed to save product" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, product });
}
