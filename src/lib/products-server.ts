import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { products as STATIC_PRODUCTS, type Product } from "@/lib/products";

const COL = "products";

type ProductDoc = Product & { updatedAt?: unknown };

function normalize(raw: Record<string, unknown>): Product | null {
  if (!raw || typeof raw.handle !== "string") return null;
  return {
    handle: String(raw.handle),
    title: String(raw.title ?? ""),
    vendor: String(raw.vendor ?? "Abandoned Alley"),
    description: String(raw.description ?? ""),
    price: Number(raw.price ?? 0),
    media: Array.isArray(raw.media) ? (raw.media as Product["media"]) : [],
    options: Array.isArray(raw.options) ? (raw.options as Product["options"]) : [],
    variants: Array.isArray(raw.variants) ? (raw.variants as Product["variants"]) : [],
    collection: String(raw.collection ?? ""),
    disabled: Boolean(raw.disabled),
  };
}

/**
 * All products from Firestore. Falls back to the bundled static catalog when
 * Firestore is empty so the storefront keeps working out of the box.
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const snap = await getDocs(collection(db, COL));
    if (!snap.empty) {
      return snap.docs
        .map((d) => normalize(d.data() as Record<string, unknown>))
        .filter((p): p is Product => p !== null);
    }
  } catch (err) {
    console.error("Firestore products fetch failed, using static seed:", err);
  }
  return STATIC_PRODUCTS;
}

/** Public-facing listing: omits disabled items. */
export async function getActiveProducts(): Promise<Product[]> {
  return (await getAllProducts()).filter((p) => !p.disabled);
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, COL, handle));
    if (snap.exists()) {
      return normalize(snap.data() as Record<string, unknown>);
    }
  } catch (err) {
    console.error("Firestore product fetch failed:", err);
  }
  const fallback = STATIC_PRODUCTS.find((p) => p.handle === handle);
  return fallback ?? null;
}

export async function upsertProduct(p: Product): Promise<void> {
  const docData: ProductDoc = { ...p, updatedAt: serverTimestamp() };
  await setDoc(doc(db, COL, p.handle), docData);
}

export async function deleteProduct(handle: string): Promise<void> {
  await deleteDoc(doc(db, COL, handle));
}
