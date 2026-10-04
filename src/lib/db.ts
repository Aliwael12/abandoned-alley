// The store's database: Supabase Postgres, reached over a direct connection
// from the server only (see supabase/migrations for the schema).
//
// Column names are the old Firestore field names in snake_case. The client
// converts column names both ways (discountAmount <-> discount_amount), so
// rows come back with the same camelCase keys the app has always used, and
// objects can be written with sql(row). Keys *inside* jsonb values are left
// exactly as stored: postgres.camel would rename those too, which would mangle
// data such as stock keys ("handle::size"), so only column names are mapped.

import { randomBytes } from "node:crypto";
import postgres from "postgres";

const globalForDb = globalThis as unknown as { __aaSql?: postgres.Sql };

export const sql: postgres.Sql =
  globalForDb.__aaSql ??
  (globalForDb.__aaSql = postgres(process.env.DATABASE_URL ?? "", {
    // Supabase's transaction pooler (port 6543) can't hold prepared statements.
    prepare: false,
    // One serverless instance serves one request at a time; a few connections
    // cover the queries a request runs in parallel.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: {
      column: { from: postgres.toCamel, to: postgres.fromCamel },
      undefined: null,
    },
  }));

/** A query handle: the pool itself, or the connection of an open transaction. */
export type Db = postgres.Sql | postgres.TransactionSql;

/**
 * Copy of `row` with the named jsonb columns wrapped for sending as JSON.
 * Postgres.js only serializes a plain object or array as JSON when told to.
 */
export function withJson<T extends Record<string, unknown>>(
  db: Db,
  row: T,
  jsonColumns: readonly (keyof T)[]
): T {
  const out: Record<string, unknown> = { ...row };
  for (const col of jsonColumns) {
    const v = out[col as string];
    if (v !== undefined && v !== null) out[col as string] = db.json(v as postgres.JSONValue);
  }
  return out as T;
}

/** Epoch ms from a timestamp column (Date), a stored number, or an ISO string. */
export function toMillis(v: unknown): number | null {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * A new 20-character alphanumeric id, the same shape as the Firestore ids the
 * existing orders carry, so old and new order numbers look alike.
 */
export function newId(): string {
  const bytes = randomBytes(20);
  let id = "";
  for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
  return id;
}
