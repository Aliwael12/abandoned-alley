import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SHIPPING_FEES, type ShippingFees } from "@/lib/shipping";

const COL = "settings";
const DOC = "store";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getShippingFees(): Promise<ShippingFees> {
  try {
    const snap = await getDoc(doc(db, COL, DOC));
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      // Fall back to the legacy single `shippingFee` field if the new
      // per-zone fields haven't been set yet.
      const legacy = data.shippingFee;
      return {
        metro: num(
          data.metroShippingFee,
          num(legacy, DEFAULT_SHIPPING_FEES.metro)
        ),
        outer: num(
          data.outerShippingFee,
          num(legacy, DEFAULT_SHIPPING_FEES.outer)
        ),
      };
    }
  } catch (err) {
    console.error("getShippingFees failed:", err);
  }
  return { ...DEFAULT_SHIPPING_FEES };
}

export async function setShippingFees(fees: ShippingFees): Promise<void> {
  await setDoc(
    doc(db, COL, DOC),
    {
      metroShippingFee: fees.metro,
      outerShippingFee: fees.outer,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getDefaultSizeChartHandle(): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, COL, DOC));
    if (snap.exists()) {
      const v = snap.data().defaultSizeChartHandle;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  } catch (err) {
    console.error("getDefaultSizeChartHandle failed:", err);
  }
  return null;
}

export async function setDefaultSizeChartHandle(handle: string | null): Promise<void> {
  await setDoc(
    doc(db, COL, DOC),
    {
      defaultSizeChartHandle: handle ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
