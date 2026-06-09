import { NextResponse } from "next/server";
import { getCities, isShipBluConfigured } from "@/lib/shipblu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isShipBluConfigured()) {
    return NextResponse.json({ cities: [] });
  }
  const { id } = await ctx.params;
  const governorateId = Number(id);
  if (!Number.isInteger(governorateId) || governorateId <= 0) {
    return NextResponse.json({ error: "Invalid governorate id" }, { status: 400 });
  }
  try {
    const cities = await getCities(governorateId);
    return NextResponse.json({ cities });
  } catch (err) {
    console.error("ShipBlu cities error:", err);
    return NextResponse.json({ error: "Could not load cities" }, { status: 502 });
  }
}
