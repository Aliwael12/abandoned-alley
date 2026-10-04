import { NextResponse } from "next/server";
import { getOfferConfig } from "@/lib/settings-server";
import { isOfferLive } from "@/lib/offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The spend offer as the storefront needs it: the config while it's running
 * (for Egypt), or null. The cart only previews totals with this — checkout
 * re-reads the settings and decides for itself.
 */
export async function GET() {
  const offer = await getOfferConfig();
  return NextResponse.json({ offer: isOfferLive(offer, "eg") ? offer : null });
}
