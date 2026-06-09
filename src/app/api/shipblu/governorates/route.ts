import { NextResponse } from "next/server";
import { getGovernorates, isShipBluConfigured } from "@/lib/shipblu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public proxy: the storefront checkout needs the ShipBlu governorate list but
// must never see the secret API key, so we fetch it server-side here.
export async function GET() {
  if (!isShipBluConfigured()) {
    return NextResponse.json({ governorates: [] });
  }
  try {
    const governorates = await getGovernorates();
    return NextResponse.json({ governorates });
  } catch (err) {
    console.error("ShipBlu governorates error:", err);
    return NextResponse.json(
      { error: "Could not load governorates" },
      { status: 502 }
    );
  }
}
