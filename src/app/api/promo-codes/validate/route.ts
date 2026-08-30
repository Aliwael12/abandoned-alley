import { NextResponse } from "next/server";
import { getPromoCodeByCode } from "@/lib/promo-codes-server";
import {
  computePromoDiscount,
  normalizePromoCode,
  PROMO_VALIDATION_MESSAGE,
  validatePromo,
} from "@/lib/promo-codes";
import { toRegion } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated: lets the checkout form preview a code's discount
 * before the order is placed. The subtotal here is advisory only — the
 * checkout API recomputes the discount itself from the code and its own
 * server-side subtotal, so a tampered value here can't change what's charged.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const code = normalizePromoCode(String(b.code ?? ""));
  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }
  const region = toRegion(b.region);
  const subtotal = Number(b.subtotal);

  const promo = await getPromoCodeByCode(code);
  const err = validatePromo(promo, region);
  if (err) {
    return NextResponse.json({ error: PROMO_VALIDATION_MESSAGE[err] }, { status: 400 });
  }

  const discount = computePromoDiscount(promo!, Number.isFinite(subtotal) ? subtotal : 0, region);
  return NextResponse.json({
    ok: true,
    code: promo!.code,
    type: promo!.type,
    value: promo!.type === "percentage" ? promo!.value : region === "us" ? promo!.valueUsd : promo!.value,
    discount,
  });
}
