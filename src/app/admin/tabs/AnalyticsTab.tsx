"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  CompareRangePicker,
  DateRangePicker,
  previousPeriod,
  type DateRange,
} from "./DateRangePicker";

type Point = { date: string; current: number; previous: number };
type Breakdown = { label?: string; title?: string; current: number; previous: number };

type Kpi = {
  current: number;
  previous: number;
  changePct: number | null;
  sparkline: number[];
};

type Analytics = {
  range: {
    days: number;
    currentStart: string;
    currentEnd: string;
    previousStart: string | null;
    previousEnd: string | null;
    compareDays: number;
  };
  kpis: {
    grossSales: Kpi;
    netSales: Kpi;
    orders: Kpi;
    deliveredOrders: Kpi;
    sessions: Kpi;
    conversionRate: Kpi;
    avgOrderValue: Kpi;
    returningCustomerRate: Kpi;
  };
  series: {
    sales: Point[];
    netSales: Point[];
    orders: Point[];
    deliveredOrders: Point[];
    sessions: Point[];
    conversionRate: Point[];
    avgOrderValue: Point[];
  };
  breakdowns: {
    productSales: Breakdown[];
    productVariantSales: Breakdown[];
    locations: Breakdown[];
    socialReferrers: Breakdown[];
    salesByReferrer: Breakdown[];
    salesBySocialReferrer: Breakdown[];
    utmSource: Breakdown[];
    utmMedium: Breakdown[];
    utmCampaign: Breakdown[];
  };
};

const fmtEgp = (n: number) =>
  `EGP ${Math.round(n).toLocaleString("en-US")}`;

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
};

const fmtPct = (n: number, digits = 2) => `${n.toFixed(digits)}%`;

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m ?? 1) - 1]} ${d}`;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
        <Minus size={11} /> —
      </span>
    );
  }
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const color = up ? "text-emerald-400" : "text-white/40";
  const abs = Math.abs(pct);
  const display =
    abs >= 1000 ? `${(abs / 1000).toFixed(1)}K%` : `${abs.toFixed(abs < 10 ? 1 : 0)}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${color}`}>
      <Icon size={11} />
      {display}
    </span>
  );
}

function Sparkline({ values, color = "#ffffff" }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const w = 120;
  const h = 36;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  pct,
  spark,
  sparkColor,
}: {
  label: string;
  value: string;
  pct: number | null;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center justify-between gap-4">
      <div className="flex flex-col gap-2 min-w-0">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/50 truncate">
          {label}
        </p>
        <p className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.05em] leading-none">
          {value}
        </p>
        <ChangeBadge pct={pct} />
      </div>
      {spark && spark.length > 1 && (
        <div className="shrink-0 opacity-90">
          <Sparkline values={spark} color={sparkColor ?? "#ffffff"} />
        </div>
      )}
    </div>
  );
}

type ValueFmt = (n: number) => string;

function LineChart({
  title,
  total,
  pct,
  series,
  format,
  rangeLabel,
  prevRangeLabel,
}: {
  title: string;
  total: string;
  pct: number | null;
  series: Point[];
  format: ValueFmt;
  rangeLabel: string;
  prevRangeLabel: string;
}) {
  const { current, previous, dates } = useMemo(() => {
    return {
      current: series.map((p) => p.current),
      previous: series.map((p) => p.previous),
      dates: series.map((p) => p.date),
    };
  }, [series]);

  const w = 600;
  const h = 200;
  const pad = { top: 16, right: 8, bottom: 24, left: 44 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const max = Math.max(1, ...current, ...previous);
  const step = current.length > 1 ? innerW / (current.length - 1) : innerW;

  const lineFor = (arr: number[]) =>
    arr
      .map((v, i) => `${pad.left + i * step},${pad.top + innerH - (v / max) * innerH}`)
      .join(" ");

  const ticks = 3;
  const gridLines = Array.from({ length: ticks + 1 }, (_, i) => {
    const value = max * (1 - i / ticks);
    const y = pad.top + (innerH * i) / ticks;
    return { y, value };
  });

  const xTickCount = Math.min(5, dates.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i * (dates.length - 1)) / Math.max(1, xTickCount - 1));
    return { x: pad.left + idx * step, label: formatShortDate(dates[idx] ?? "") };
  });

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h3 className="text-sm font-semibold tracking-wide text-white/80 underline decoration-dotted decoration-white/20 underline-offset-4">
          {title}
        </h3>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <p className="font-[family-name:var(--font-bebas)] text-3xl tracking-[0.04em] leading-none">
          {total}
        </p>
        <ChangeBadge pct={pct} />
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={g.y}
              y2={g.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={g.y + 3}
              textAnchor="end"
              fontSize={10}
              fill="rgba(255,255,255,0.4)"
            >
              {format(g.value)}
            </text>
          </g>
        ))}
        {previous.some((v) => v > 0) && (
          <polyline
            points={lineFor(previous)}
            fill="none"
            stroke="rgba(120, 180, 240, 0.55)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
        <polyline
          points={lineFor(current)}
          fill="none"
          stroke="#22a8ff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xTicks.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={h - 6}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(255,255,255,0.45)"
          >
            {t.label}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-6 mt-3 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-[2px] bg-[#22a8ff] rounded" />
          {rangeLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-4 h-[2px] rounded"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(120,180,240,0.55) 0 3px, transparent 3px 6px)",
            }}
          />
          {prevRangeLabel}
        </span>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  format,
}: {
  title: string;
  rows: { label: string; current: number; previous: number }[];
  format: ValueFmt;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.current, r.previous)));
  const empty = rows.length === 0;
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-sm font-semibold tracking-wide text-white/80 underline decoration-dotted decoration-white/20 underline-offset-4 mb-5">
        {title}
      </h3>
      {empty ? (
        <p className="text-xs text-white/40 py-4">No data in this period.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.slice(0, 8).map((r) => {
            const currW = (r.current / max) * 100;
            const prevW = (r.previous / max) * 100;
            const pct =
              r.previous === 0
                ? r.current === 0
                  ? 0
                  : null
                : ((r.current - r.previous) / r.previous) * 100;
            return (
              <li key={r.label} className="flex flex-col gap-1.5">
                <p className="text-xs text-white/70 truncate">{r.label}</p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-2 rounded-sm bg-[#22a8ff]"
                    style={{ width: `${Math.max(2, currW)}%` }}
                  />
                  <span className="text-xs text-white/80 tabular-nums">
                    {format(r.current)}
                  </span>
                  <ChangeBadge pct={pct} />
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="h-1.5 rounded-sm bg-[#22a8ff]/30"
                    style={{ width: `${Math.max(1, prevW)}%` }}
                  />
                  <span className="text-[11px] text-white/40 tabular-nums">
                    {format(r.previous)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AnalyticsView({
  range,
  compare,
}: {
  range: DateRange;
  compare: DateRange | null;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      start: range.start,
      end: range.end,
    });
    if (compare) {
      params.set("compareStart", compare.start);
      params.set("compareEnd", compare.end);
    } else {
      params.set("compare", "none");
    }
    fetch(`/api/admin/analytics?${params.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? "Failed");
        return (await r.json()) as Analytics;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, compare?.start, compare?.end, compare]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass rounded-md p-4 text-sm text-[var(--accent)]">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { kpis, series, breakdowns, range: apiRange } = data;
  const currentLabel = `${formatShortDate(apiRange.currentStart)}–${formatShortDate(
    apiRange.currentEnd
  )}`;
  const previousLabel =
    apiRange.previousStart && apiRange.previousEnd
      ? `${formatShortDate(apiRange.previousStart)}–${formatShortDate(
          apiRange.previousEnd
        )}`
      : "No comparison";

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-white/60">
        {currentLabel} vs {previousLabel}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Gross sales"
          value={fmtEgp(kpis.grossSales.current)}
          pct={kpis.grossSales.changePct}
          spark={kpis.grossSales.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Net sales"
          value={fmtEgp(kpis.netSales.current)}
          pct={kpis.netSales.changePct}
          spark={kpis.netSales.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Orders"
          value={fmtCompact(kpis.orders.current)}
          pct={kpis.orders.changePct}
          spark={kpis.orders.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Delivered orders"
          value={fmtCompact(kpis.deliveredOrders.current)}
          pct={kpis.deliveredOrders.changePct}
          spark={kpis.deliveredOrders.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Sessions"
          value={fmtCompact(kpis.sessions.current)}
          pct={kpis.sessions.changePct}
          spark={kpis.sessions.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Conversion rate"
          value={fmtPct(kpis.conversionRate.current, 2)}
          pct={kpis.conversionRate.changePct}
          spark={kpis.conversionRate.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Average order value"
          value={fmtEgp(kpis.avgOrderValue.current)}
          pct={kpis.avgOrderValue.changePct}
          spark={kpis.avgOrderValue.sparkline}
          sparkColor="#22a8ff"
        />
        <KpiCard
          label="Returning customer rate"
          value={fmtPct(kpis.returningCustomerRate.current, 2)}
          pct={kpis.returningCustomerRate.changePct}
          spark={kpis.returningCustomerRate.sparkline}
          sparkColor="#22a8ff"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChart
          title="Sessions over time"
          total={fmtCompact(kpis.sessions.current)}
          pct={kpis.sessions.changePct}
          series={series.sessions}
          format={(n) => fmtCompact(n)}
          rangeLabel={currentLabel}
          prevRangeLabel={previousLabel}
        />
        <LineChart
          title="Conversion rate over time"
          total={fmtPct(kpis.conversionRate.current, 2)}
          pct={kpis.conversionRate.changePct}
          series={series.conversionRate}
          format={(n) => `${n.toFixed(1)}%`}
          rangeLabel={currentLabel}
          prevRangeLabel={previousLabel}
        />
        <LineChart
          title="Average order value over time"
          total={fmtEgp(kpis.avgOrderValue.current)}
          pct={kpis.avgOrderValue.changePct}
          series={series.avgOrderValue}
          format={(n) => `EGP ${fmtCompact(n)}`}
          rangeLabel={currentLabel}
          prevRangeLabel={previousLabel}
        />
        <LineChart
          title="Total sales over time"
          total={fmtEgp(kpis.grossSales.current)}
          pct={kpis.grossSales.changePct}
          series={series.sales}
          format={(n) => `EGP ${fmtCompact(n)}`}
          rangeLabel={currentLabel}
          prevRangeLabel={previousLabel}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title="Total sales by product"
          rows={breakdowns.productSales.map((p) => ({
            label: p.title ?? "Unknown",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
        <BreakdownCard
          title="Total sales by variant"
          rows={breakdowns.productVariantSales.map((p) => ({
            label: p.title ?? "Unknown",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
        <BreakdownCard
          title="Sessions by location"
          rows={breakdowns.locations.map((p) => ({
            label: p.label ?? "Unknown",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => fmtCompact(n)}
        />
        <BreakdownCard
          title="Sessions by social referrer"
          rows={breakdowns.socialReferrers.map((p) => ({
            label: p.label ?? "Unknown",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => fmtCompact(n)}
        />
        <BreakdownCard
          title="Total sales by social referrer"
          rows={breakdowns.salesBySocialReferrer.map((p) => ({
            label: p.label ?? "direct",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
        <BreakdownCard
          title="Total sales by referrer"
          rows={breakdowns.salesByReferrer.map((p) => ({
            label: p.label ?? "direct",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
        <BreakdownCard
          title="Sales by UTM source"
          rows={breakdowns.utmSource.map((p) => ({
            label: p.label ?? "—",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
        <BreakdownCard
          title="Sales by UTM campaign"
          rows={breakdowns.utmCampaign.map((p) => ({
            label: p.label ?? "—",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
        <BreakdownCard
          title="Sales by UTM medium"
          rows={breakdowns.utmMedium.map((p) => ({
            label: p.label ?? "—",
            current: p.current,
            previous: p.previous,
          }))}
          format={(n) => `EGP ${fmtCompact(n)}`}
        />
      </section>
    </div>
  );
}

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

export default function AnalyticsTab() {
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [compare, setCompare] = useState<DateRange | null>(() =>
    previousPeriod(defaultRange())
  );

  function handleRangeChange(r: DateRange) {
    setRange(r);
    // Auto-shift comparison to the new "previous period" unless user had explicitly cleared it.
    setCompare((cur) => (cur === null ? null : previousPeriod(r)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end gap-2">
        <DateRangePicker value={range} onChange={handleRangeChange} />
        <CompareRangePicker
          primary={range}
          value={compare}
          onChange={setCompare}
        />
      </div>
      <AnalyticsView
        key={`${range.start}-${range.end}-${compare?.start ?? "x"}-${compare?.end ?? "x"}`}
        range={range}
        compare={compare}
      />
    </div>
  );
}
