// Copies the store's data from Firestore into the Supabase Postgres tables
// (supabase/migrations). Reads Firestore through its public REST API with the
// web API key, so it needs no service account; writes over DATABASE_URL.
//
//   node scripts/migrate-firestore-to-supabase.mjs                  # copy everything (upsert)
//   node scripts/migrate-firestore-to-supabase.mjs --insert-missing # cutover top-up
//   node scripts/migrate-firestore-to-supabase.mjs --dry-run        # read + map only
//
// --insert-missing only adds documents Postgres doesn't have yet and never
// touches existing rows: it's for orders/visits that reached Firestore while
// the old deployment was still serving after the switch. For each order it
// inserts, it also takes that order's recorded stock out of Postgres, since
// those units were only deducted in Firestore.
//
// Reads NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY and
// DATABASE_URL from the environment or from .env.

import fs from "node:fs";
import postgres from "postgres";

const args = new Set(process.argv.slice(2));
const INSERT_MISSING = args.has("--insert-missing");
const DRY_RUN = args.has("--dry-run");

const env = { ...readDotEnv(), ...process.env };
const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!PROJECT || !API_KEY || !env.DATABASE_URL) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY or DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  onnotice: () => {},
  transform: { column: { from: postgres.toCamel, to: postgres.fromCamel }, undefined: null },
});

function readDotEnv() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env", "utf8")
        .split(/\r?\n/)
        .filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
    );
  } catch {
    return {};
  }
}

// --- Firestore REST -> plain JS ---------------------------------------------

function fromValue(v) {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields ?? {});
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  return null;
}

function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));
}

async function readCollection(name) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${name}`;
  const docs = [];
  let pageToken = "";
  do {
    const url = `${base}?pageSize=300&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) throw new Error(`Reading ${name}: ${body.error?.status ?? res.status}`);
    for (const d of body.documents ?? []) {
      docs.push({ id: d.name.split("/").pop(), data: fromFields(d.fields ?? {}) });
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return docs;
}

// --- documents -> rows ----------------------------------------------------------

const pick = (data, keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const date = (v) => (v instanceof Date ? v : typeof v === "number" ? new Date(v) : null);

// Dates inside jsonb (e.g. legacy ShipBlu fields) are kept as ISO strings.
function jsonSafe(v) {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)]));
  return v;
}

const ORDER_COLUMNS = [
  "status", "region", "currency", "customer", "shipping", "items", "notes", "subtotal",
  "discountAmount", "promoCode", "shippingFee", "shippingZone", "droppinAutoPush", "attribution",
  "stockDeducted", "createdAt", "approvedAt", "deliveredAt", "cancelledAt", "refundedAt",
  "droppinPackageId", "droppinTrackingNumber", "droppinStatus", "droppinPushedAt", "droppinError",
  "droppinPushAttemptedAt", "paymentMethod", "paymentStatus", "stripeSessionId",
  "stripePaymentIntentId", "amountPaid", "paidAt", "stripeRefundId", "offerTier", "offerDiscount",
  "deliveryFeeWaived",
];
const CHECKOUT_COLUMNS = [
  "status", "region", "currency", "customer", "shipping", "items", "notes", "subtotal",
  "discountAmount", "promoCode", "shippingFee", "shippingZone", "droppinAutoPush", "attribution",
  "stockDeducted", "createdAt", "stripeSessionId", "paidAt", "releasedAt", "releaseReason",
];

const TABLES = [
  {
    collection: "products",
    table: "products",
    key: "handle",
    json: ["media", "options", "variants", "stock", "stockUs"],
    toRow: ({ id, data }) => ({
      handle: data.handle ?? id,
      title: data.title ?? "",
      vendor: data.vendor ?? "Abandoned Alley",
      description: data.description ?? "",
      price: num(data.price) ?? 0,
      priceUsd: num(data.priceUsd),
      media: data.media ?? [],
      options: data.options ?? [],
      variants: data.variants ?? [],
      collection: data.collection ?? "",
      disabled: data.disabled === true,
      stock: data.stock ?? {},
      stockUs: data.stockUs ?? {},
      sizeChartId: data.sizeChartId || null,
      sortOrder: num(data.sortOrder),
      category: data.category ?? null,
      pairsWith: Array.isArray(data.pairsWith) ? data.pairsWith : null,
      updatedAt: date(data.updatedAt) ?? new Date(),
    }),
  },
  {
    collection: "collections",
    table: "collections",
    key: "handle",
    json: [],
    toRow: ({ id, data }) => ({
      handle: data.handle ?? id,
      title: data.title ?? "",
      image: data.image ?? "",
      description: data.description ?? "",
      createdAt: date(data.createdAt) ?? new Date(),
      updatedAt: date(data.updatedAt) ?? new Date(),
    }),
  },
  {
    collection: "sizeCharts",
    table: "size_charts",
    key: "handle",
    json: ["columnDefs", "rows"],
    toRow: ({ id, data }) => ({
      handle: data.handle ?? id,
      name: data.name ?? id,
      note: data.note ?? null,
      columns: Array.isArray(data.columns) ? data.columns.map(String) : [],
      columnDefs: data.columnDefs ?? [],
      rows: data.rows ?? [],
      updatedAt: date(data.updatedAt) ?? new Date(),
    }),
  },
  {
    collection: "promoCodes",
    table: "promo_codes",
    key: "code",
    json: [],
    toRow: ({ id, data }) => ({
      code: data.code ?? id,
      type: data.type === "fixed" ? "fixed" : "percentage",
      value: num(data.value) ?? 0,
      valueUsd: num(data.valueUsd),
      validUntil: date(data.validUntil),
      active: data.active !== false,
      createdAt: date(data.createdAt) ?? new Date(),
    }),
  },
  {
    collection: "settings",
    table: "settings",
    key: "key",
    json: ["data"],
    toRow: ({ id, data }) => {
      const { updatedAt, ...rest } = data;
      return { key: id, data: jsonSafe(rest), updatedAt: date(updatedAt) ?? new Date() };
    },
  },
  {
    collection: "contact",
    table: "contact_messages",
    key: "id",
    json: [],
    toRow: ({ id, data }) => ({
      id,
      name: data.name ?? "",
      email: data.email ?? "",
      message: data.message ?? "",
      status: data.status ?? "new",
      createdAt: date(data.createdAt) ?? new Date(),
    }),
  },
  {
    collection: "subscribers",
    table: "subscribers",
    key: "email",
    json: [],
    toRow: ({ id, data }) => ({
      email: data.email ?? id,
      status: data.status ?? "subscribed",
      subscribedAt: date(data.subscribedAt) ?? new Date(),
    }),
  },
  {
    collection: "sessions",
    table: "sessions",
    key: "id",
    json: ["utm"],
    toRow: ({ id, data }) => ({
      id,
      sessionId: data.sessionId ?? null,
      path: data.path ?? null,
      referrer: data.referrer ?? null,
      referrerHost: data.referrerHost ?? null,
      socialReferrer: data.socialReferrer ?? null,
      country: data.country ?? null,
      region: data.region ?? null,
      city: data.city ?? null,
      utm: data.utm ?? null,
      createdAt: date(data.createdAt) ?? new Date(),
    }),
  },
  {
    collection: "orders",
    table: "orders",
    key: "id",
    json: ["customer", "shipping", "items", "attribution", "stockDeducted", "legacy"],
    toRow: ({ id, data }) => orderRow(id, data, ORDER_COLUMNS, true),
  },
  {
    collection: "checkouts",
    table: "checkouts",
    key: "id",
    json: ["customer", "shipping", "items", "attribution", "stockDeducted"],
    toRow: ({ id, data }) => orderRow(id, data, CHECKOUT_COLUMNS, false),
  },
];

function orderRow(id, data, columns, keepLegacy) {
  const row = { id, ...pick(data, columns) };
  // Fields that are timestamps everywhere else must be Dates here too.
  for (const k of ["createdAt", "approvedAt", "deliveredAt", "cancelledAt", "refundedAt", "droppinPushedAt", "droppinPushAttemptedAt", "paidAt", "releasedAt"]) {
    if (k in row) row[k] = date(row[k]);
  }
  for (const k of ["subtotal", "discountAmount", "shippingFee", "amountPaid", "offerDiscount", "deliveryFeeWaived", "droppinPackageId"]) {
    if (k in row) row[k] = num(row[k]);
  }
  row.status ??= columns === CHECKOUT_COLUMNS ? "open" : "pending";
  row.region ??= "eg"; // orders from before the US store were all Egypt's
  row.currency ??= row.region === "us" ? "USD" : "EGP";
  row.subtotal ??= 0;
  row.discountAmount ??= 0;
  row.shippingFee ??= 0;
  row.createdAt ??= new Date();
  for (const k of ["customer", "shipping", "attribution", "stockDeducted"]) {
    if (k in row && row[k] !== null) row[k] = jsonSafe(row[k]);
  }
  row.customer ??= {};
  row.shipping ??= {};
  row.items = jsonSafe(row.items ?? []);
  if (keepLegacy) {
    const extra = Object.fromEntries(Object.entries(data).filter(([k]) => !columns.includes(k)));
    row.legacy = Object.keys(extra).length ? jsonSafe(extra) : null;
  }
  return row;
}

// --- write -------------------------------------------------------------------

function wrapJson(row, jsonColumns) {
  const out = { ...row };
  for (const c of jsonColumns) if (out[c] !== null && out[c] !== undefined) out[c] = sql.json(out[c]);
  return out;
}

async function write(spec, rows) {
  const keyColumn = postgres.fromCamel(spec.key);
  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => wrapJson(r, spec.json));
    // A multi-row insert sends one column list for every row, so it must be
    // the union of all rows' fields (an order without Droppin fields mustn't
    // drop them for the rest of the batch); rows missing a field send null.
    const columns = [...new Set(chunk.flatMap((r) => Object.keys(r)))];
    for (const r of chunk) for (const c of columns) if (!(c in r)) r[c] = null;
    const result = INSERT_MISSING
      ? await sql`insert into ${sql(spec.table)} ${sql(chunk, columns)} on conflict (${sql(keyColumn)}) do nothing returning ${sql(spec.key)}`
      : await sql`insert into ${sql(spec.table)} ${sql(chunk, columns)}
          on conflict (${sql(keyColumn)}) do update set ${sql(
            Object.fromEntries(columns.filter((c) => c !== spec.key).map((c) => [c, sql`excluded.${sql(postgres.fromCamel(c))}`]))
          )} returning ${sql(spec.key)}`;
    written += result.length;
    if (INSERT_MISSING) spec.inserted = [...(spec.inserted ?? []), ...result.map((r) => r[spec.key])];
  }
  return written;
}

/** Orders added by --insert-missing took their stock in Firestore only. */
async function deductStockForInserted(orderIds, rowsById) {
  for (const id of orderIds) {
    const order = rowsById.get(id);
    const held = order?.stockDeducted;
    if (!held || typeof held !== "object") continue;
    const column = order.region === "us" ? "stockUs" : "stock";
    for (const [key, qty] of Object.entries(held)) {
      const sep = key.lastIndexOf("::");
      const handle = key.slice(0, sep);
      const size = key.slice(sep + 2);
      const n = Math.floor(Number(qty));
      if (!handle || !size || !(n > 0)) continue;
      await sql`
        update products
        set ${sql(column)} = jsonb_set(${sql(column)}, ${[size]}::text[],
          to_jsonb(greatest(0, coalesce((${sql(column)} ->> ${size})::int, 0) - ${n})))
        where handle = ${handle}`;
      console.log(`  stock: ${handle} ${size} -${n} (${column}) for order ${id}`);
    }
  }
}

console.log(`${DRY_RUN ? "Dry run" : INSERT_MISSING ? "Inserting missing documents" : "Copying everything"}: Firestore ${PROJECT} -> Supabase`);
let failed = false;
for (const spec of TABLES) {
  try {
    const docs = await readCollection(spec.collection);
    const rows = docs.map(spec.toRow);
    if (DRY_RUN || rows.length === 0) {
      console.log(`${spec.collection.padEnd(12)} ${String(docs.length).padStart(5)} read${DRY_RUN ? "" : ", nothing to write"}`);
      continue;
    }
    const written = await write(spec, rows);
    console.log(`${spec.collection.padEnd(12)} ${String(docs.length).padStart(5)} read, ${written} ${INSERT_MISSING ? "new" : "written"}`);
    if (INSERT_MISSING && spec.table === "orders" && spec.inserted?.length) {
      await deductStockForInserted(spec.inserted, new Map(rows.map((r) => [r.id, r])));
    }
  } catch (err) {
    failed = true;
    console.error(`${spec.collection}: FAILED — ${err.message}`);
  }
}
await sql.end();
process.exit(failed ? 1 : 0);
