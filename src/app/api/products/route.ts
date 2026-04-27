import { NextResponse } from "next/server";
import { getActiveProducts } from "@/lib/products-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getActiveProducts();
  return NextResponse.json({ products });
}
