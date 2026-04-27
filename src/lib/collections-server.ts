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
import { collections as STATIC_COLLECTIONS } from "@/lib/products";

const COL = "collections";

export type CollectionMeta = {
  handle: string;
  title: string;
  image: string;
  description?: string;
  count?: number;
};

function normalize(raw: Record<string, unknown>): CollectionMeta | null {
  if (!raw || typeof raw.handle !== "string") return null;
  return {
    handle: String(raw.handle),
    title: String(raw.title ?? ""),
    image: String(raw.image ?? ""),
    description:
      typeof raw.description === "string" ? (raw.description as string) : undefined,
  };
}

function fallback(): CollectionMeta[] {
  return STATIC_COLLECTIONS.map((c) => ({
    handle: c.handle,
    title: c.title,
    image: c.image,
  }));
}

export async function getAllCollections(): Promise<CollectionMeta[]> {
  try {
    const snap = await getDocs(collection(db, COL));
    if (!snap.empty) {
      return snap.docs
        .map((d) => normalize(d.data() as Record<string, unknown>))
        .filter((c): c is CollectionMeta => c !== null);
    }
  } catch (err) {
    console.error("Firestore collections fetch failed, using static seed:", err);
  }
  return fallback();
}

export async function getCollectionByHandle(
  handle: string
): Promise<CollectionMeta | null> {
  try {
    const snap = await getDoc(doc(db, COL, handle));
    if (snap.exists()) {
      return normalize(snap.data() as Record<string, unknown>);
    }
  } catch (err) {
    console.error("Firestore collection fetch failed:", err);
  }
  return fallback().find((c) => c.handle === handle) ?? null;
}

export async function upsertCollection(c: CollectionMeta): Promise<void> {
  const docData: Record<string, unknown> = {
    handle: c.handle,
    title: c.title,
    image: c.image,
    description: c.description ?? "",
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, COL, c.handle), docData, { merge: true });
}

export async function createCollection(c: CollectionMeta): Promise<void> {
  const docData: Record<string, unknown> = {
    handle: c.handle,
    title: c.title,
    image: c.image,
    description: c.description ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, COL, c.handle), docData);
}

export async function deleteCollection(handle: string): Promise<void> {
  await deleteDoc(doc(db, COL, handle));
}
