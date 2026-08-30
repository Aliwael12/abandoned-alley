import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PromoCode, PromoDiscountType } from "@/lib/promo-codes";

const COL = "promoCodes";

function tsToMillis(ts: unknown): number | null {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === "object" && "seconds" in ts) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return null;
}

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
    validUntil: typeof raw.validUntil === "number" ? raw.validUntil : tsToMillis(raw.validUntil),
    active: typeof raw.active === "boolean" ? raw.active : true,
    createdAt: tsToMillis(raw.createdAt) ?? undefined,
  };
}

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  try {
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map((d) => normalize(d.data() as Record<string, unknown>))
      .filter((p): p is PromoCode => p !== null)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch (err) {
    console.error("getAllPromoCodes failed:", err);
    return [];
  }
}

export async function getPromoCodeByCode(code: string): Promise<PromoCode | null> {
  try {
    const snap = await getDoc(doc(db, COL, code));
    if (snap.exists()) {
      return normalize(snap.data() as Record<string, unknown>);
    }
  } catch (err) {
    console.error("getPromoCodeByCode failed:", err);
  }
  return null;
}

export async function createPromoCode(
  promo: Omit<PromoCode, "createdAt">
): Promise<void> {
  await setDoc(doc(db, COL, promo.code), {
    code: promo.code,
    type: promo.type,
    value: promo.value,
    ...(promo.valueUsd !== undefined ? { valueUsd: promo.valueUsd } : {}),
    validUntil: promo.validUntil,
    active: promo.active,
    createdAt: serverTimestamp(),
  });
}

export async function updatePromoCode(
  code: string,
  patch: Partial<Omit<PromoCode, "code" | "createdAt">>
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.value !== undefined) data.value = patch.value;
  if (patch.valueUsd !== undefined) data.valueUsd = patch.valueUsd || null;
  if (patch.validUntil !== undefined) data.validUntil = patch.validUntil;
  if (patch.active !== undefined) data.active = patch.active;
  await setDoc(doc(db, COL, code), data, { merge: true });
}

export async function deletePromoCode(code: string): Promise<void> {
  await deleteDoc(doc(db, COL, code));
}
