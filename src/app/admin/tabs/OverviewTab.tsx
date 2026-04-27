"use client";

import type { OrdersResponse } from "../types";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function OverviewTab({ data }: { data: OrdersResponse | null }) {
  if (!data) return null;
  const { summary, series, orders } = data;

  const maxRevenue = Math.max(1, ...series.map((s) => s.revenue));

  const stats = [
    { label: "Total orders", value: summary.totalOrders.toLocaleString() },
    { label: "Total revenue", value: fmtUsd(summary.totalRevenue) },
    { label: "Avg order", value: fmtUsd(summary.avgOrder) },
    { label: "Last 30d", value: `${summary.last30Orders} · ${fmtUsd(summary.last30Revenue)}` },
  ];

  return (
    <div className="flex flex-col gap-8">
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
            Last 7 days
          </h2>
          <p className="text-xs text-white/40">Revenue</p>
        </div>
        <div className="grid grid-cols-7 gap-2 items-end h-40">
          {series.map((s) => {
            const height = Math.max(2, (s.revenue / maxRevenue) * 100);
            return (
              <div key={s.date} className="flex flex-col items-center gap-2 h-full">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-white/80 rounded-sm transition-all"
                    style={{ height: `${height}%` }}
                    title={`${s.date}: ${fmtUsd(s.revenue)} (${s.count} orders)`}
                  />
                </div>
                <p className="text-[10px] text-white/50">
                  {s.date.slice(5)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em] mb-4">
          Recent orders
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-white/50 py-6">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
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
                {orders.slice(0, 25).map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 font-mono text-xs text-white/70">
                      #{o.id.slice(0, 8)}
                    </td>
                    <td className="py-3 pr-4">
                      <div>{o.customerName}</div>
                      <div className="text-xs text-white/40">{o.customerEmail}</div>
                    </td>
                    <td className="py-3 pr-4">{o.itemCount}</td>
                    <td className="py-3 pr-4">
                      <span className="px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase border border-white/15 rounded">
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-white/60">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 text-right">{fmtUsd(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
