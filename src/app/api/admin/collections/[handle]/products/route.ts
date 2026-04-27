import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getCollectionByHandle } from "@/lib/collections-server";
import {
  getAllProducts,
  getProductByHandle,
  upsertProduct,
} from "@/lib/products-server";
import type { Product } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

type NewProductInput = {
  title?: string;
  description?: string;
  price?: number | string;
  image?: string;
};

type Body = {
  productHandles?: string[];
  newProduct?: NewProductInput;
};

export async function POST(
  request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;

  const collection = await getCollectionByHandle(handle);
  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assigned: string[] = [];

  if (Array.isArray(body.productHandles)) {
    for (const ph of body.productHandles) {
      const p = await getProductByHandle(String(ph));
      if (!p) continue;
      if (p.collection === handle) continue;
      const next: Product = { ...p, collection: handle };
      try {
        await upsertProduct(next);
        assigned.push(p.handle);
      } catch (err) {
        console.error(`Assign product ${p.handle} failed:`, err);
      }
    }
  }

  let created: Product | undefined;
  if (body.newProduct) {
    const np = body.newProduct;
    const title = String(np.title ?? "").trim();
    const price = Number(np.price);
    if (!title) {
      return NextResponse.json(
        { error: "newProduct.title required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "newProduct.price must be a positive number" },
        { status: 400 }
      );
    }
    const description = String(np.description ?? "").trim();
    const image = String(np.image ?? "").trim();
    const productHandle = slugify(title);
    if (!productHandle) {
      return NextResponse.json(
        { error: "Could not derive product handle from title" },
        { status: 400 }
      );
    }

    const existing = await getProductByHandle(productHandle);
    if (existing) {
      return NextResponse.json(
        { error: `Product "${productHandle}" already exists` },
        { status: 409 }
      );
    }

    const product: Product = {
      handle: productHandle,
      title,
      vendor: "Abandoned Alley",
      collection: handle,
      description,
      price,
      media: image ? [{ type: "image", src: image, alt: title }] : [],
      options: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
      variants: ["S", "M", "L", "XL"].map((sz) => ({
        id: `${productHandle}-${sz.toLowerCase()}`,
        title: sz,
        price,
        options: { Size: sz },
      })),
    };

    try {
      await upsertProduct(product);
      created = product;
    } catch (err) {
      console.error("Create product (in collection) error:", err);
      return NextResponse.json(
        { error: "Failed to create product" },
        { status: 500 }
      );
    }
  }

  // Return updated product list snapshot for the UI to refresh from
  const products = await getAllProducts();

  return NextResponse.json({
    ok: true,
    assigned,
    created,
    products,
  });
}
