"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OrderRow, OrdersResponse } from "../types";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { DateRangePicker, type DateRange } from "./DateRangePicker";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "border-white/30 text-white/70",
  approved: "border-sky-400/50 text-sky-300",
  delivered: "border-emerald-400/50 text-emerald-300",
  cancelled: "border-[var(--accent)]/50 text-[var(--accent)]",
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

const DAY_MS = 86_400_000;

function defaultRange(): DateRange {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(today) };
}

// Inclusive [start, end] in UTC millis from ISO YYYY-MM-DD strings.
function rangeBounds(range: DateRange): { startMs: number; endMs: number } {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const startMs = parse(range.start) ?? 0;
  const endParsed = parse(range.end);
  // End is inclusive: extend to the final millisecond of that day.
  const endMs = endParsed === null ? Date.now() : endParsed + DAY_MS - 1;
  return { startMs, endMs };
}

function inRange(o: OrderRow, startMs: number, endMs: number): boolean {
  return o.createdAt != null && o.createdAt >= startMs && o.createdAt <= endMs;
}

// ---------------------------------------------------------------------------
// Realized revenue (delivered orders only) with a today/week/month/all toggle.
// ---------------------------------------------------------------------------

type RevenuePeriod = "today" | "week" | "month" | "all";

const PERIODS: { id: RevenuePeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

/** Local-time start-of-period in millis (0 = include everything for "all"). */
function periodStart(period: RevenuePeriod): number {
  if (period === "all") return 0;
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  // "week" — week starts Sunday, matching the rest of the dashboard.
  const day = now.getDay();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  return sunday.getTime();
}

function RealizedRevenueBox({ orders }: { orders: OrderRow[] }) {
  const [period, setPeriod] = useState<RevenuePeriod>("month");

  const { revenue, count } = useMemo(() => {
    const start = periodStart(period);
    const delivered = orders.filter((o) => {
      if (o.status !== "delivered") return false;
      if (start === 0) return true;
      // Bucket by when revenue was realized (delivery time). Fall back to the
      // creation time for legacy orders delivered before deliveredAt existed.
      const when = o.deliveredAt ?? o.createdAt;
      return when != null && when >= start;
    });
    return {
      revenue: delivered.reduce((n, o) => n + o.subtotal, 0),
      count: delivered.length,
    };
  }, [orders, period]);

  return (
    <section className="glass rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-white/50">
            Realized revenue
          </p>
          <p className="text-[11px] text-white/40 mt-1">
            Delivered orders only
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-[11px] tracking-[0.1em] uppercase transition ${
                period === p.id
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-4">
        <p className="font-[family-name:var(--font-bebas)] text-5xl tracking-[0.04em] leading-none text-emerald-300">
          {fmtUsd(revenue)}
        </p>
        <p className="text-sm text-white/50 mb-1">
          {count.toLocaleString()} delivered order{count === 1 ? "" : "s"}
        </p>
      </div>
    </section>
  );
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type Bucket = { label: string; revenue: number; count: number };

// Build chart buckets for the selected range. Days when the span is short,
// otherwise grouped so the chart never renders an unreadable number of bars.
function buildBuckets(orders: OrderRow[], startMs: number, endMs: number): Bucket[] {
  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
  // Cap visible bars; widen each bucket's day-span as the range grows.
  const maxBars = 30;
  const span = Math.ceil(totalDays / maxBars);
  const buckets: Bucket[] = [];
  for (let i = 0; i < totalDays; i += span) {
    const bStart = startMs + i * DAY_MS;
    const bEnd = Math.min(endMs, bStart + span * DAY_MS - 1);
    const rows = orders.filter(
      (o) => o.createdAt != null && o.createdAt >= bStart && o.createdAt <= bEnd
    );
    const d = new Date(bStart);
    const label = `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
    buckets.push({
      label,
      revenue: rows.reduce((n, r) => n + r.subtotal, 0),
      count: rows.length,
    });
  }
  return buckets;
}

export default function OverviewTab({ data }: { data: OrdersResponse | null }) {
  const [range, setRange] = useState<DateRange>(() => defaultRange());

  const orders = useMemo(() => data?.orders ?? [], [data]);

  const view = useMemo(() => {
    const { startMs, endMs } = rangeBounds(range);
    const filtered = orders.filter((o) => inRange(o, startMs, endMs));
    const revenue = filtered.reduce((n, r) => n + r.subtotal, 0);
    const count = filtered.length;
    const avg = count ? revenue / count : 0;
    const buckets = buildBuckets(filtered, startMs, endMs);
    return { filtered, revenue, count, avg, buckets };
  }, [orders, range]);

  if (!data) return null;

  const { filtered, revenue, count, avg, buckets } = view;
  const maxRevenue = Math.max(1, ...buckets.map((b) => b.revenue));

  const stats = [
    { label: "Orders", value: count.toLocaleString() },
    { label: "Revenue", value: fmtUsd(revenue) },
    { label: "Avg order", value: fmtUsd(avg) },
    {
      label: "Lifetime",
      value: `${data.summary.totalOrders.toLocaleString()} · ${fmtUsd(
        data.summary.totalRevenue
      )}`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/50">
          Showing {count.toLocaleString()} order{count === 1 ? "" : "s"} in range
        </p>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <RealizedRevenueBox orders={orders} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5 flex flex-col gap-2">
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/50">
              {s.label}
            </p>
            <p className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.05em]">
              {s.value}
            </p>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Revenue
          </h2>
          <p className="text-xs text-white/40">{buckets.length} bars</p>
        </div>
        {buckets.length === 0 ? (
          <p className="text-sm text-white/50 py-6">No orders in this range.</p>
        ) : (
          <div
            className="grid gap-1 sm:gap-2 items-end h-40"
            style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
          >
            {buckets.map((b, i) => {
              const height = Math.max(2, (b.revenue / maxRevenue) * 100);
              // On narrow screens, ~40px-wide "Mon DD" labels collide once there
              // are more than a handful of bars. Show at most ~6 labels on mobile
              // (every Nth bar, always the last); show all from sm up.
              const mobileStride = Math.ceil(buckets.length / 6);
              const showOnMobile =
                i % mobileStride === 0 || i === buckets.length - 1;
              return (
                <div key={i} className="flex flex-col items-center gap-2 h-full min-w-0">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full bg-white/80 rounded-sm transition-all"
                      style={{ height: `${height}%` }}
                      title={`${b.label}: ${fmtUsd(b.revenue)} (${b.count} orders)`}
                    />
                  </div>
                  <p
                    className={`text-[10px] text-white/50 truncate w-full text-center ${
                      showOnMobile ? "" : "hidden sm:block"
                    }`}
                  >
                    {b.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em] mb-4">
          Orders in range
        </h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-white/50 py-6">No orders in this range.</p>
        ) : (
          <>
            {/* Mobile: stacked order cards */}
            <ul className="md:hidden flex flex-col gap-2">
              {filtered.slice(0, 50).map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="rounded-xl border border-white/10 p-3 flex flex-col gap-2 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-white/60">
                        #{o.id.slice(0, 8)}
                      </span>
                      <span className="text-sm font-medium">
                        {fmtUsd(o.subtotal)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">{o.customerName}</div>
                      <div className="text-xs text-white/40 truncate">
                        {o.customerEmail}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase border rounded ${STATUS_STYLES[o.status]}`}
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                      <span className="text-[11px] text-white/50">
                        {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop: full table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                <tr className="text-[10px] tracking-[0.2em] uppercase text-white/40 border-b border-white/10">
                  <th className="text-left py-2 pr-4">Order</th>
                  <th className="text-left py-2 pr-4">Customer</th>
                  <th className="text-left py-2 pr-4">Items</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer group"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-white/70">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="block group-hover:text-white"
                      >
                        #{o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/admin/orders/${o.id}`} className="block">
                        <div>{o.customerName}</div>
                        <div className="text-xs text-white/40">{o.customerEmail}</div>
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/admin/orders/${o.id}`} className="block">
                        {o.itemCount}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/admin/orders/${o.id}`} className="block">
                        <span
                          className={`px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase border rounded ${STATUS_STYLES[o.status]}`}
                        >
                          {STATUS_LABEL[o.status]}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-xs text-white/60">
                      <Link href={`/admin/orders/${o.id}`} className="block">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                      </Link>
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/admin/orders/${o.id}`} className="block">
                        {fmtUsd(o.subtotal)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
