import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const COL = "settings";
const DOC = "store";

export async function getShippingFee(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, COL, DOC));
    if (snap.exists()) {
      const v = Number((snap.data() as Record<string, unknown>).shippingFee);
      if (Number.isFinite(v) && v >= 0) return v;
    }
  } catch (err) {
    console.error("getShippingFee failed:", err);
  }
  return 0;
}

export async function setShippingFee(value: number): Promise<void> {
  await setDoc(
    doc(db, COL, DOC),
    { shippingFee: value, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
