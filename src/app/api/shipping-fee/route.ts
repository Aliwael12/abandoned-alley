import { NextResponse } from "next/server";
import { getShippingFees } from "@/lib/settings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const fees = await getShippingFees();
  return NextResponse.json({
    metroShippingFee: fees.metro,
    outerShippingFee: fees.outer,
  });
}
