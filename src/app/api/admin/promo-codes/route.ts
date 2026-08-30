import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  createPromoCode,
  getAllPromoCodes,
  getPromoCodeByCode,
} from "@/lib/promo-codes-server";
import { normalizePromoCode, type PromoDiscountType } from "@/lib/promo-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const codes = await getAllPromoCodes();
  return NextResponse.json({ codes });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = normalizePromoCode(String(body.code ?? ""));
  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }
  if (await getPromoCodeByCode(code)) {
    return NextResponse.json({ error: `Code "${code}" already exists` }, { status: 409 });
  }

  const type: PromoDiscountType = body.type === "fixed" ? "fixed" : "percentage";
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Invalid discount value" }, { status: 400 });
  }
  if (type === "percentage" && value > 100) {
    return NextResponse.json({ error: "Percentage must be 100 or less" }, { status: 400 });
  }

  let valueUsd: number | undefined;
  if (type === "fixed" && body.valueUsd !== undefined && body.valueUsd !== null && body.valueUsd !== "") {
    const usd = Number(body.valueUsd);
    if (!Number.isFinite(usd) || usd <= 0) {
      return NextResponse.json({ error: "Invalid USD discount value" }, { status: 400 });
    }
    valueUsd = usd;
  }

  let validUntil: number | null = null;
  if (body.validUntil !== undefined && body.validUntil !== null && body.validUntil !== "") {
    const ms = new Date(String(body.validUntil)).getTime();
    if (!Number.isFinite(ms)) {
      return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
    }
    validUntil = ms;
  }

  const active = body.active !== false;

  try {
    await createPromoCode({ code, type, value, valueUsd, validUntil, active });
  } catch (err) {
    console.error("Create promo code error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code: { code, type, value, valueUsd, validUntil, active },
  });
}
