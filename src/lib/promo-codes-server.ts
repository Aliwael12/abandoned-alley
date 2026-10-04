import { sql, toMillis } from "@/lib/db";
import type { PromoCode, PromoDiscountType } from "@/lib/promo-codes";

function normalize(raw: Record<string, unknown>): PromoCode | null {
  const code = String(raw.code ?? "").trim();
  if (!code) return null;
  const type: PromoDiscountType = raw.type === "fixed" ? "fixed" : "percentage";
  const value = Number(raw.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const valueUsd = Number(raw.valueUsd);
  return {
    code,
    type,
    value,
    valueUsd: Number.isFinite(valueUsd) && valueUsd > 0 ? valueUsd : undefined,
    validUntil: toMillis(raw.validUntil),
    active: typeof raw.active === "boolean" ? raw.active : true,
    createdAt: toMillis(raw.createdAt) ?? undefined,
  };
}

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  try {
    const rows = await sql`select * from promo_codes order by created_at desc`;
    return rows
      .map((r) => normalize(r))
      .filter((p): p is PromoCode => p !== null);
  } catch (err) {
    console.error("getAllPromoCodes failed:", err);
    return [];
  }
}

export async function getPromoCodeByCode(code: string): Promise<PromoCode | null> {
  try {
    const [row] = await sql`select * from promo_codes where code = ${code}`;
    if (row) return normalize(row);
  } catch (err) {
    console.error("getPromoCodeByCode failed:", err);
  }
  return null;
}

const asDate = (ms: number | null | undefined) => (typeof ms === "number" ? new Date(ms) : null);

export async function createPromoCode(
  promo: Omit<PromoCode, "createdAt">
): Promise<void> {
  await sql`
    insert into promo_codes ${sql({
      code: promo.code,
      type: promo.type,
      value: promo.value,
      valueUsd: promo.valueUsd ?? null,
      validUntil: asDate(promo.validUntil),
      active: promo.active,
      createdAt: new Date(),
    })}
    on conflict (code) do update set
      type = excluded.type, value = excluded.value, value_usd = excluded.value_usd,
      valid_until = excluded.valid_until, active = excluded.active`;
}

export async function updatePromoCode(
  code: string,
  patch: Partial<Omit<PromoCode, "code" | "createdAt">>
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.value !== undefined) data.value = patch.value;
  if (patch.valueUsd !== undefined) data.valueUsd = patch.valueUsd || null;
  if (patch.validUntil !== undefined) data.validUntil = asDate(patch.validUntil);
  if (patch.active !== undefined) data.active = patch.active;
  if (!Object.keys(data).length) return;
  await sql`update promo_codes set ${sql(data)} where code = ${code}`;
}

export async function deletePromoCode(code: string): Promise<void> {
  await sql`delete from promo_codes where code = ${code}`;
}
