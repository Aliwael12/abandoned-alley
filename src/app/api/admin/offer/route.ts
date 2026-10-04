import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getOfferConfig, setOfferConfig } from "@/lib/settings-server";
import { normalizeOffer } from "@/lib/offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getOfferConfig());
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const offer = normalizeOffer(body);
  if (offer.freeDeliveryAt <= 0 || offer.discountAt <= 0 || offer.discountAmount <= 0) {
    return NextResponse.json({ error: "Thresholds and the discount must be above 0." }, { status: 400 });
  }
  if (offer.discountAt <= offer.freeDeliveryAt) {
    return NextResponse.json(
      { error: "The discount threshold must be higher than the free-delivery threshold." },
      { status: 400 }
    );
  }
  if (offer.discountAmount >= offer.discountAt) {
    return NextResponse.json(
      { error: "The discount must be smaller than its threshold." },
      { status: 400 }
    );
  }
  if (offer.startsAt !== null && offer.endsAt !== null && offer.endsAt <= offer.startsAt) {
    return NextResponse.json({ error: "The end date must be after the start date." }, { status: 400 });
  }

  try {
    await setOfferConfig(offer);
  } catch (err) {
    console.error("setOfferConfig failed:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json(offer);
}
