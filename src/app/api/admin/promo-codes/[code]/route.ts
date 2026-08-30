import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  deletePromoCode,
  getPromoCodeByCode,
  updatePromoCode,
} from "@/lib/promo-codes-server";
import { normalizePromoCode, type PromoDiscountType } from "@/lib/promo-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const code = normalizePromoCode(decodeURIComponent((await ctx.params).code));

  const existing = await getPromoCodeByCode(code);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<{
    type: PromoDiscountType;
    value: number;
    valueUsd: number | undefined;
    validUntil: number | null;
    active: boolean;
  }> = {};

  const type: PromoDiscountType | undefined =
    body.type === "fixed" || body.type === "percentage" ? body.type : undefined;
  if (type) patch.type = type;
  const effectiveType = type ?? existing.type;

  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: "Invalid discount value" }, { status: 400 });
    }
    if (effectiveType === "percentage" && value > 100) {
      return NextResponse.json({ error: "Percentage must be 100 or less" }, { status: 400 });
    }
    patch.value = value;
  }

  if (body.valueUsd !== undefined) {
    if (body.valueUsd === null || body.valueUsd === "") {
      patch.valueUsd = undefined;
    } else {
      const usd = Number(body.valueUsd);
      if (!Number.isFinite(usd) || usd <= 0) {
        return NextResponse.json({ error: "Invalid USD discount value" }, { status: 400 });
      }
      patch.valueUsd = usd;
    }
  }

  if (body.validUntil !== undefined) {
    if (body.validUntil === null || body.validUntil === "") {
      patch.validUntil = null;
    } else {
      const ms = new Date(String(body.validUntil)).getTime();
      if (!Number.isFinite(ms)) {
        return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
      }
      patch.validUntil = ms;
    }
  }

  if (body.active !== undefined) {
    patch.active = Boolean(body.active);
  }

  try {
    await updatePromoCode(code, patch);
  } catch (err) {
    console.error("Update promo code error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const code = normalizePromoCode(decodeURIComponent((await ctx.params).code));

  try {
    await deletePromoCode(code);
  } catch (err) {
    console.error("Delete promo code error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
