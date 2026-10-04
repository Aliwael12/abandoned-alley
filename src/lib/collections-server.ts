import { sql } from "@/lib/db";
import { collections as STATIC_COLLECTIONS } from "@/lib/products";

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
    const rows = await sql`select * from collections order by created_at`;
    if (rows.length) {
      return rows
        .map((r) => normalize(r))
        .filter((c): c is CollectionMeta => c !== null);
    }
  } catch (err) {
    console.error("Collections fetch failed, using static seed:", err);
  }
  return fallback();
}

export async function getCollectionByHandle(
  handle: string
): Promise<CollectionMeta | null> {
  try {
    const [row] = await sql`select * from collections where handle = ${handle}`;
    if (row) return normalize(row);
  } catch (err) {
    console.error("Collection fetch failed:", err);
  }
  return fallback().find((c) => c.handle === handle) ?? null;
}

export async function upsertCollection(c: CollectionMeta): Promise<void> {
  const row = {
    handle: c.handle,
    title: c.title,
    image: c.image,
    description: c.description ?? "",
    updatedAt: new Date(),
  };
  await sql`
    insert into collections ${sql(row)}
    on conflict (handle) do update set ${sql(row)}`;
}

export async function createCollection(c: CollectionMeta): Promise<void> {
  const now = new Date();
  await sql`
    insert into collections ${sql({
      handle: c.handle,
      title: c.title,
      image: c.image,
      description: c.description ?? "",
      createdAt: now,
      updatedAt: now,
    })}`;
}

export async function deleteCollection(handle: string): Promise<void> {
  await sql`delete from collections where handle = ${handle}`;
}
