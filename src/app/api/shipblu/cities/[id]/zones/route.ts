import { NextResponse } from "next/server";
import { getZones, isShipBluConfigured } from "@/lib/shipblu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isShipBluConfigured()) {
    return NextResponse.json({ zones: [] });
  }
  const { id } = await ctx.params;
  const cityId = Number(id);
  if (!Number.isInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "Invalid city id" }, { status: 400 });
  }
  try {
    const zones = await getZones(cityId);
    return NextResponse.json({ zones });
  } catch (err) {
    console.error("ShipBlu zones error:", err);
    return NextResponse.json({ error: "Could not load zones" }, { status: 502 });
  }
}
