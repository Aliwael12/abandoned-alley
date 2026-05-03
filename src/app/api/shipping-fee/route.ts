import { NextResponse } from "next/server";
import { getShippingFee } from "@/lib/settings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const shippingFee = await getShippingFee();
  return NextResponse.json({ shippingFee });
}
