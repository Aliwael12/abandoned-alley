import { NextResponse } from "next/server";
import {
  Timestamp,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = { date: string; value: number };
type Point = { date: string; current: number; previous: number };
type Breakdown = { label: string; current: number; previous: number };

type OrderItem = {
  productHandle?: string;
  title?: string;
  variantTitle?: string;
  variantId?: string;
  price?: number;
  quantity?: number;
};

const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "refunded",
  "returned",
  "failed",
  "void",
]);
const DELIVERED_STATUSES = new Set([
  "delivered",
  "completed",
  "fulfilled",
  "shipped",
]);

function isCancelled(order: OrderDoc): boolean {
  const s = String(order.status ?? "").toLowerCase();
  const d = String(order.droppinStatus ?? "").toLowerCase();
  return CANCELLED_STATUSES.has(s) || CANCELLED_STATUSES.has(d);
}

function isDelivered(order: OrderDoc): boolean {
  const s = String(order.status ?? "").toLowerCase();
  const d = String(order.droppinStatus ?? "").toLowerCase();
  return DELIVERED_STATUSES.has(s) || DELIVERED_STATUSES.has(d);
}

type OrderDoc = {
  customer?: { email?: string };
  items?: OrderItem[];
  subtotal?: number;
  status?: string;
  droppinStatus?: string;
  attribution?: {
    sessionId?: string | null;
    referrerHost?: string | null;
    socialReferrer?: string | null;
    utm?: {
      source?: string | null;
      medium?: string | null;
      campaign?: string | null;
      content?: string | null;
      term?: string | null;
    } | null;
  } | null;
  createdAt?: unknown;
};

type SessionDoc = {
  referrerHost?: string | null;
  socialReferrer?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  createdAt?: unknown;
};

function tsToMillis(ts: unknown): number | null {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  if (typeof ts === "number") return ts;
  return null;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function emptyBuckets(start: number, days: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = 0; i < days; i++) {
    out.push({ date: isoDay(start + i * DAY_MS), value: 0 });
  }
  return out;
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) {
    if (curr === 0) return 0;
    return null;
  }
  return ((curr - prev) / prev) * 100;
}

function parseIsoToUtc(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(ms) ? null : ms;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Resolve current range. Prefer explicit start/end; fall back to legacy days.
  const startParam = parseIsoToUtc(searchParams.get("start"));
  const endParam = parseIsoToUtc(searchParams.get("end"));

  let periodStart: number;
  let periodEnd: number; // exclusive upper bound (start of day after `end`)
  let days: number;

  if (startParam !== null && endParam !== null && endParam >= startParam) {
    periodStart = startParam;
    periodEnd = endParam + DAY_MS;
    days = Math.max(1, Math.round((periodEnd - periodStart) / DAY_MS));
  } else {
    days = Math.min(
      365,
      Math.max(1, Number(searchParams.get("days") ?? 30))
    );
    periodEnd = startOfUtcDay(Date.now()) + DAY_MS;
    periodStart = periodEnd - days * DAY_MS;
  }

  // Resolve comparison range. Default to previous period of equal length.
  const compStartParam = parseIsoToUtc(searchParams.get("compareStart"));
  const compEndParam = parseIsoToUtc(searchParams.get("compareEnd"));
  const noCompare = searchParams.get("compare") === "none";

  let prevStart: number;
  let prevEnd: number;
  if (noCompare) {
    prevStart = periodStart;
    prevEnd = periodStart;
  } else if (
    compStartParam !== null &&
    compEndParam !== null &&
    compEndParam >= compStartParam
  ) {
    prevStart = compStartParam;
    prevEnd = compEndParam + DAY_MS;
  } else {
    prevStart = periodStart - days * DAY_MS;
    prevEnd = periodStart;
  }

  const fetchFloor = Math.min(periodStart, prevStart);

  let orderSnap;
  let sessionSnap;
  try {
    [orderSnap, sessionSnap] = await Promise.all([
      getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "sessions"), orderBy("createdAt", "desc"))),
    ]);
  } catch (err) {
    console.error("Analytics fetch error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }

  const orders = orderSnap.docs
    .map((d) => {
      const data = d.data() as OrderDoc;
      return { ...data, _createdAt: tsToMillis(data.createdAt) };
    })
    .filter(
      (o): o is OrderDoc & { _createdAt: number } =>
        typeof o._createdAt === "number" && o._createdAt >= fetchFloor
    );

  const sessions = sessionSnap.docs
    .map((d) => {
      const data = d.data() as SessionDoc;
      return { ...data, _createdAt: tsToMillis(data.createdAt) };
    })
    .filter(
      (s): s is SessionDoc & { _createdAt: number } =>
        typeof s._createdAt === "number" && s._createdAt >= fetchFloor
    );

  const compareDays = noCompare
    ? 0
    : Math.max(0, Math.round((prevEnd - prevStart) / DAY_MS));

  function bucketize(
    items: { _createdAt: number }[],
    extract: (i: { _createdAt: number }) => number,
    start: number,
    len: number
  ): Bucket[] {
    const buckets = emptyBuckets(start, len);
    const index = new Map(buckets.map((b, i) => [b.date, i]));
    for (const it of items) {
      const day = isoDay(startOfUtcDay(it._createdAt));
      const i = index.get(day);
      if (i === undefined) continue;
      buckets[i].value += extract(it);
    }
    return buckets;
  }

  function combine(curr: Bucket[], prev: Bucket[]): Point[] {
    return curr.map((c, i) => ({
      date: c.date,
      current: c.value,
      previous: prev[i]?.value ?? 0,
    }));
  }

  const currentOrders = orders.filter(
    (o) => o._createdAt >= periodStart && o._createdAt < periodEnd
  );
  const previousOrders = noCompare
    ? []
    : orders.filter(
        (o) => o._createdAt >= prevStart && o._createdAt < prevEnd
      );
  const currentSessions = sessions.filter(
    (s) => s._createdAt >= periodStart && s._createdAt < periodEnd
  );
  const previousSessions = noCompare
    ? []
    : sessions.filter(
        (s) => s._createdAt >= prevStart && s._createdAt < prevEnd
      );

  // Gross sales over time (all orders' subtotal regardless of status)
  const salesCurr = bucketize(
    currentOrders,
    (o) => Number((o as OrderDoc).subtotal ?? 0),
    periodStart,
    days
  );
  const salesPrev = bucketize(
    previousOrders,
    (o) => Number((o as OrderDoc).subtotal ?? 0),
    prevStart,
    compareDays
  );

  // Net sales = gross minus cancelled/refunded/returned
  const netSalesCurr = bucketize(
    currentOrders,
    (o) => {
      const od = o as OrderDoc;
      return isCancelled(od) ? 0 : Number(od.subtotal ?? 0);
    },
    periodStart,
    days
  );
  const netSalesPrev = bucketize(
    previousOrders,
    (o) => {
      const od = o as OrderDoc;
      return isCancelled(od) ? 0 : Number(od.subtotal ?? 0);
    },
    prevStart,
    compareDays
  );

  // Orders count over time
  const ordersCurr = bucketize(currentOrders, () => 1, periodStart, days);
  const ordersPrev = bucketize(previousOrders, () => 1, prevStart, compareDays);

  // Delivered orders over time
  const deliveredCurr = bucketize(
    currentOrders,
    (o) => (isDelivered(o as OrderDoc) ? 1 : 0),
    periodStart,
    days
  );
  const deliveredPrev = bucketize(
    previousOrders,
    (o) => (isDelivered(o as OrderDoc) ? 1 : 0),
    prevStart,
    compareDays
  );

  // AOV over time = sales / orders per day
  const aovCurr: Bucket[] = salesCurr.map((b, i) => ({
    date: b.date,
    value: ordersCurr[i].value ? b.value / ordersCurr[i].value : 0,
  }));
  const aovPrev: Bucket[] = salesPrev.map((b, i) => ({
    date: b.date,
    value: ordersPrev[i].value ? b.value / ordersPrev[i].value : 0,
  }));

  // Sessions over time
  const sessionsCurr = bucketize(currentSessions, () => 1, periodStart, days);
  const sessionsPrev = bucketize(
    previousSessions,
    () => 1,
    prevStart,
    compareDays
  );

  // Conversion rate over time = orders / sessions (in %)
  const convCurr: Bucket[] = ordersCurr.map((b, i) => ({
    date: b.date,
    value: sessionsCurr[i].value ? (b.value / sessionsCurr[i].value) * 100 : 0,
  }));
  const convPrev: Bucket[] = ordersPrev.map((b, i) => ({
    date: b.date,
    value: sessionsPrev[i].value ? (b.value / sessionsPrev[i].value) * 100 : 0,
  }));

  // Sales by product
  function productSales(list: typeof orders): Map<string, number> {
    const map = new Map<string, number>();
    for (const o of list) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const key = (it.title || it.productHandle || "Unknown").trim();
        const value = Number(it.price ?? 0) * Number(it.quantity ?? 0);
        map.set(key, (map.get(key) ?? 0) + value);
      }
    }
    return map;
  }

  const prodCurr = productSales(currentOrders);
  const prodPrev = productSales(previousOrders);
  const productKeys = Array.from(
    new Set([...prodCurr.keys(), ...prodPrev.keys()])
  );
  const productBreakdown = productKeys
    .map((title) => ({
      title,
      current: prodCurr.get(title) ?? 0,
      previous: prodPrev.get(title) ?? 0,
    }))
    .sort((a, b) => b.current - a.current);

  // Sales by product variant (product · size/variant)
  function variantSales(list: typeof orders): Map<string, number> {
    const map = new Map<string, number>();
    for (const o of list) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const product = (it.title || it.productHandle || "Unknown").trim();
        const variant = (it.variantTitle || "").trim();
        const key = variant ? `${product} · ${variant}` : product;
        const value = Number(it.price ?? 0) * Number(it.quantity ?? 0);
        map.set(key, (map.get(key) ?? 0) + value);
      }
    }
    return map;
  }
  const varCurr = variantSales(currentOrders);
  const varPrev = variantSales(previousOrders);
  const variantKeys = Array.from(
    new Set([...varCurr.keys(), ...varPrev.keys()])
  );
  const variantBreakdown = variantKeys
    .map((title) => ({
      title,
      current: varCurr.get(title) ?? 0,
      previous: varPrev.get(title) ?? 0,
    }))
    .sort((a, b) => b.current - a.current);

  // Sessions by location
  function locationCounts(list: typeof sessions): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of list) {
      if (!s.country) continue;
      const parts = [s.country, s.region, s.city].filter(
        (p): p is string => Boolean(p)
      );
      const key = parts.join(" · ");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }
  const locCurr = locationCounts(currentSessions);
  const locPrev = locationCounts(previousSessions);
  const locationKeys = Array.from(
    new Set([...locCurr.keys(), ...locPrev.keys()])
  );
  const locationBreakdown = locationKeys
    .map((label) => ({
      label,
      current: locCurr.get(label) ?? 0,
      previous: locPrev.get(label) ?? 0,
    }))
    .sort((a, b) => b.current - a.current);

  // Sessions by social referrer
  function socialCounts(list: typeof sessions): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of list) {
      if (!s.socialReferrer) continue;
      map.set(s.socialReferrer, (map.get(s.socialReferrer) ?? 0) + 1);
    }
    return map;
  }
  const socCurr = socialCounts(currentSessions);
  const socPrev = socialCounts(previousSessions);
  const socialKeys = Array.from(
    new Set([...socCurr.keys(), ...socPrev.keys()])
  );
  const socialBreakdown = socialKeys
    .map((label) => ({
      label,
      current: socCurr.get(label) ?? 0,
      previous: socPrev.get(label) ?? 0,
    }))
    .sort((a, b) => b.current - a.current);

  // Sales by referrer — uses per-order attribution when present (precise), else
  // falls back to same-day session-share proportional split for legacy orders.
  function salesByChannel(
    orderList: typeof orders,
    sessionList: typeof sessions
  ): Map<string, number> {
    const dayShares = new Map<string, Map<string, number>>();
    for (const s of sessionList) {
      const day = isoDay(startOfUtcDay(s._createdAt));
      const channel = s.socialReferrer ?? s.referrerHost ?? "direct";
      const inner = dayShares.get(day) ?? new Map<string, number>();
      inner.set(channel, (inner.get(channel) ?? 0) + 1);
      dayShares.set(day, inner);
    }
    const out = new Map<string, number>();
    for (const o of orderList) {
      const od = o as OrderDoc;
      const revenue = Number(od.subtotal ?? 0);
      const attr = od.attribution ?? null;
      if (attr) {
        const channel =
          attr.utm?.source ||
          attr.socialReferrer ||
          attr.referrerHost ||
          "direct";
        out.set(channel, (out.get(channel) ?? 0) + revenue);
        continue;
      }
      const day = isoDay(startOfUtcDay(o._createdAt));
      const shares = dayShares.get(day);
      if (!shares || shares.size === 0) {
        out.set("direct", (out.get("direct") ?? 0) + revenue);
        continue;
      }
      const total = Array.from(shares.values()).reduce((a, b) => a + b, 0);
      for (const [channel, count] of shares) {
        out.set(channel, (out.get(channel) ?? 0) + (revenue * count) / total);
      }
    }
    return out;
  }

  // Sales by UTM dimension — only from orders that have per-order attribution.
  function salesByUtm(
    orderList: typeof orders,
    dim: "source" | "medium" | "campaign" | "content" | "term"
  ): Map<string, number> {
    const out = new Map<string, number>();
    for (const o of orderList) {
      const od = o as OrderDoc;
      const value = od.attribution?.utm?.[dim] ?? null;
      if (!value) continue;
      const revenue = Number(od.subtotal ?? 0);
      out.set(value, (out.get(value) ?? 0) + revenue);
    }
    return out;
  }

  const salesChCurr = salesByChannel(currentOrders, currentSessions);
  const salesChPrev = salesByChannel(previousOrders, previousSessions);
  const salesChKeys = Array.from(
    new Set([...salesChCurr.keys(), ...salesChPrev.keys()])
  );
  const salesByReferrer = salesChKeys
    .map((label) => ({
      label,
      current: salesChCurr.get(label) ?? 0,
      previous: salesChPrev.get(label) ?? 0,
    }))
    .sort((a, b) => b.current - a.current);

  // Sales by social referrer only
  function salesBySocial(
    orderList: typeof orders,
    sessionList: typeof sessions
  ): Map<string, number> {
    const dayShares = new Map<string, Map<string, number>>();
    for (const s of sessionList) {
      if (!s.socialReferrer) continue;
      const day = isoDay(startOfUtcDay(s._createdAt));
      const inner = dayShares.get(day) ?? new Map<string, number>();
      inner.set(
        s.socialReferrer,
        (inner.get(s.socialReferrer) ?? 0) + 1
      );
      dayShares.set(day, inner);
    }
    const out = new Map<string, number>();
    for (const o of orderList) {
      const day = isoDay(startOfUtcDay(o._createdAt));
      const revenue = Number((o as OrderDoc).subtotal ?? 0);
      const shares = dayShares.get(day);
      if (!shares || shares.size === 0) continue;
      const total = Array.from(shares.values()).reduce((a, b) => a + b, 0);
      for (const [channel, count] of shares) {
        out.set(channel, (out.get(channel) ?? 0) + (revenue * count) / total);
      }
    }
    return out;
  }

  // UTM breakdowns (only from per-order attribution)
  function utmBreakdown(
    dim: "source" | "medium" | "campaign"
  ): Breakdown[] {
    const curr = salesByUtm(currentOrders, dim);
    const prev = salesByUtm(previousOrders, dim);
    const keys = Array.from(new Set([...curr.keys(), ...prev.keys()]));
    return keys
      .map((label) => ({
        label,
        current: curr.get(label) ?? 0,
        previous: prev.get(label) ?? 0,
      }))
      .sort((a, b) => b.current - a.current);
  }
  const utmSourceBreakdown = utmBreakdown("source");
  const utmMediumBreakdown = utmBreakdown("medium");
  const utmCampaignBreakdown = utmBreakdown("campaign");

  const socSalesCurr = salesBySocial(currentOrders, currentSessions);
  const socSalesPrev = salesBySocial(previousOrders, previousSessions);
  const socSalesKeys = Array.from(
    new Set([...socSalesCurr.keys(), ...socSalesPrev.keys()])
  );
  const salesBySocialReferrer = socSalesKeys
    .map((label) => ({
      label,
      current: socSalesCurr.get(label) ?? 0,
      previous: socSalesPrev.get(label) ?? 0,
    }))
    .sort((a, b) => b.current - a.current);

  // Returning customer rate
  function returningRate(list: typeof orders): number {
    const counts = new Map<string, number>();
    for (const o of list) {
      const email = String(o.customer?.email ?? "")
        .trim()
        .toLowerCase();
      if (!email) continue;
      counts.set(email, (counts.get(email) ?? 0) + 1);
    }
    const customers = counts.size;
    if (!customers) return 0;
    const returning = Array.from(counts.values()).filter((n) => n > 1).length;
    return (returning / customers) * 100;
  }

  const sum = (arr: Bucket[]) => arr.reduce((n, b) => n + b.value, 0);
  const totalSalesCurr = sum(salesCurr);
  const totalSalesPrev = sum(salesPrev);
  const totalNetSalesCurr = sum(netSalesCurr);
  const totalNetSalesPrev = sum(netSalesPrev);
  const totalOrdersCurr = sum(ordersCurr);
  const totalOrdersPrev = sum(ordersPrev);
  const totalDeliveredCurr = sum(deliveredCurr);
  const totalDeliveredPrev = sum(deliveredPrev);
  const totalSessionsCurr = sum(sessionsCurr);
  const totalSessionsPrev = sum(sessionsPrev);
  const aovTotalCurr = totalOrdersCurr ? totalSalesCurr / totalOrdersCurr : 0;
  const aovTotalPrev = totalOrdersPrev ? totalSalesPrev / totalOrdersPrev : 0;
  const convTotalCurr = totalSessionsCurr
    ? (totalOrdersCurr / totalSessionsCurr) * 100
    : 0;
  const convTotalPrev = totalSessionsPrev
    ? (totalOrdersPrev / totalSessionsPrev) * 100
    : 0;
  const returnCurr = returningRate(currentOrders);
  const returnPrev = returningRate(previousOrders);

  return NextResponse.json({
    range: {
      days,
      currentStart: isoDay(periodStart),
      currentEnd: isoDay(periodEnd - DAY_MS),
      previousStart: noCompare ? null : isoDay(prevStart),
      previousEnd: noCompare ? null : isoDay(prevEnd - DAY_MS),
      compareDays: noCompare ? 0 : compareDays,
    },
    kpis: {
      grossSales: {
        current: totalSalesCurr,
        previous: totalSalesPrev,
        changePct: pctChange(totalSalesCurr, totalSalesPrev),
        sparkline: salesCurr.map((b) => b.value),
      },
      netSales: {
        current: totalNetSalesCurr,
        previous: totalNetSalesPrev,
        changePct: pctChange(totalNetSalesCurr, totalNetSalesPrev),
        sparkline: netSalesCurr.map((b) => b.value),
      },
      orders: {
        current: totalOrdersCurr,
        previous: totalOrdersPrev,
        changePct: pctChange(totalOrdersCurr, totalOrdersPrev),
        sparkline: ordersCurr.map((b) => b.value),
      },
      deliveredOrders: {
        current: totalDeliveredCurr,
        previous: totalDeliveredPrev,
        changePct: pctChange(totalDeliveredCurr, totalDeliveredPrev),
        sparkline: deliveredCurr.map((b) => b.value),
      },
      sessions: {
        current: totalSessionsCurr,
        previous: totalSessionsPrev,
        changePct: pctChange(totalSessionsCurr, totalSessionsPrev),
        sparkline: sessionsCurr.map((b) => b.value),
      },
      conversionRate: {
        current: convTotalCurr,
        previous: convTotalPrev,
        changePct: pctChange(convTotalCurr, convTotalPrev),
        sparkline: convCurr.map((b) => b.value),
      },
      avgOrderValue: {
        current: aovTotalCurr,
        previous: aovTotalPrev,
        changePct: pctChange(aovTotalCurr, aovTotalPrev),
        sparkline: aovCurr.map((b) => b.value),
      },
      returningCustomerRate: {
        current: returnCurr,
        previous: returnPrev,
        changePct: pctChange(returnCurr, returnPrev),
        sparkline: [],
      },
    },
    series: {
      sales: combine(salesCurr, salesPrev),
      netSales: combine(netSalesCurr, netSalesPrev),
      orders: combine(ordersCurr, ordersPrev),
      deliveredOrders: combine(deliveredCurr, deliveredPrev),
      sessions: combine(sessionsCurr, sessionsPrev),
      conversionRate: combine(convCurr, convPrev),
      avgOrderValue: combine(aovCurr, aovPrev),
    },
    breakdowns: {
      productSales: productBreakdown,
      productVariantSales: variantBreakdown,
      locations: locationBreakdown,
      socialReferrers: socialBreakdown,
      salesByReferrer,
      salesBySocialReferrer,
      utmSource: utmSourceBreakdown,
      utmMedium: utmMediumBreakdown,
      utmCampaign: utmCampaignBreakdown,
    },
  });
}
