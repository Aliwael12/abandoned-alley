"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  PackageCheck,
  RefreshCw,
  Truck,
  XCircle,
} from "lucide-react";
import {
  CARRIER_LABEL,
  ORDER_STATUSES,
  STATUS_LABEL,
  type Carrier,
  type OrderStatus,
} from "@/lib/order-status";
import { EGYPT_GOVERNORATES } from "@/lib/shipping";
import type { OrderRow } from "../types";

const fmtEgp = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });

type SortKey = "date" | "total" | "governorate" | "carrier" | "status";
type SortDir = "asc" | "desc";

type BulkAction = "approve" | "deliver" | "cancel";

type BulkResult = {
  action: BulkAction;
  total: number;
  succeeded: number;
  failed: number;
  results: {
    id: string;
    ok: boolean;
    status?: string;
    error?: string;
    dispatch?: { ok: boolean; error?: string };
  }[];
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "border-white/30 text-white/70",
  approved: "border-sky-400/50 text-sky-300",
  delivered: "border-emerald-400/50 text-emerald-300",
  cancelled: "border-[var(--accent)]/50 text-[var(--accent)]",
};

const CARRIER_STYLES: Record<Carrier, string> = {
  droppin: "border-violet-400/50 text-violet-300",
  shipblu: "border-amber-400/50 text-amber-300",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase border rounded ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CarrierBadge({ carrier }: { carrier: Carrier }) {
  return (
    <span
      className={`px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase border rounded ${CARRIER_STYLES[carrier]}`}
    >
      {CARRIER_LABEL[carrier]}
    </span>
  );
}

export default function OrdersTab({
  onChanged,
  onError,
}: {
  onChanged: () => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [governorate, setGovernorate] = useState<string>("all");
  const [carrier, setCarrier] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<BulkResult | null>(null);

  // Fetch orders. State is only ever set past the await boundary so this is safe
  // to call from an effect (no synchronous setState in the effect body).
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to load orders");
      const data = (await res.json()) as { orders: OrderRow[] };
      setOrders(data.orders);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/orders", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? "Failed to load orders");
        return (await r.json()) as { orders: OrderRow[] };
      })
      .then((data) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          onError(err instanceof Error ? err.message : "Failed to load orders");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  // Governorates that actually appear in the orders, for a tidy filter list.
  const governoratesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders ?? []) if (o.governorate) set.add(o.governorate);
    // Keep canonical ordering from the shipping list.
    return EGYPT_GOVERNORATES.filter((g) => set.has(g));
  }, [orders]);

  const filtered = useMemo(() => {
    let rows = orders ?? [];
    if (governorate !== "all") rows = rows.filter((o) => o.governorate === governorate);
    if (carrier !== "all") rows = rows.filter((o) => o.carrier === carrier);
    if (status !== "all") rows = rows.filter((o) => o.status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.governorate.toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "total":
          return (a.subtotal - b.subtotal) * dir;
        case "governorate":
          return a.governorate.localeCompare(b.governorate) * dir;
        case "carrier":
          return a.carrier.localeCompare(b.carrier) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "date":
        default:
          return ((a.createdAt ?? 0) - (b.createdAt ?? 0)) * dir;
      }
    });
    return sorted;
  }, [orders, governorate, carrier, status, search, sortKey, sortDir]);

  // Effective selection = chosen ids that are still visible under the current
  // filters. Derived at render time (no effect syncing stored state) so stale
  // ids from a previous filter never leak into counts or bulk actions.
  const selectedVisible = useMemo(() => {
    const ids: string[] = [];
    for (const o of filtered) if (selected.has(o.id)) ids.push(o.id);
    return ids;
  }, [filtered, selected]);

  const allVisibleSelected =
    filtered.length > 0 && selectedVisible.length === filtered.length;
  const someSelected = selectedVisible.length > 0;

  function toggleAll() {
    setSelected(
      allVisibleSelected ? new Set() : new Set(filtered.map((o) => o.id))
    );
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "total" ? "desc" : "asc");
    }
  }

  async function runBulk(action: BulkAction) {
    if (!someSelected) return;
    const ids = selectedVisible;
    const verb =
      action === "approve" ? "Approve" : action === "deliver" ? "Mark delivered" : "Cancel";
    if (!confirm(`${verb} ${ids.length} order${ids.length === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = (await res.json()) as BulkResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed");
      setLastResult(data);
      if (data.failed > 0) {
        const reasons = Array.from(
          new Set(data.results.filter((r) => !r.ok).map((r) => r.error ?? "Unknown error"))
        );
        const detail =
          reasons.length === 1 ? reasons[0] : `${reasons.length} distinct reasons`;
        onError(`${data.failed} of ${data.total} failed: ${detail}.`);
      }
      // Refresh both this tab's table and the dashboard-level data feeding the
      // Overview tab (realized revenue, stats), so the two never disagree.
      await Promise.all([load(), onChanged()]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBusy(false);
    }
  }

  const selectCls =
    "bg-white/5 border border-white/15 rounded-md h-9 px-3 text-sm outline-none focus:border-white/40 transition";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Orders ({filtered.length})
        </h2>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          disabled={loading || busy}
          className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 hover:border-white/40 rounded-md text-xs tracking-[0.2em] uppercase transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <input
          placeholder="Search name, phone, email, id, governorate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${selectCls} w-full sm:flex-1 sm:min-w-[180px]`}
        />
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${selectCls} min-w-0`}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className={`${selectCls} min-w-0`}
            aria-label="Filter by carrier"
          >
            <option value="all">All carriers</option>
            <option value="droppin">{CARRIER_LABEL.droppin}</option>
            <option value="shipblu">{CARRIER_LABEL.shipblu}</option>
          </select>
          <select
            value={governorate}
            onChange={(e) => setGovernorate(e.target.value)}
            className={`${selectCls} min-w-0`}
            aria-label="Filter by governorate"
          >
            <option value="all">All governorates</option>
            {governoratesPresent.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="glass rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap sticky top-2 z-10">
          <span className="text-sm text-white/80">
            {selectedVisible.length} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            <button
              onClick={() => runBulk("approve")}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-sky-400/40 text-sky-300 hover:bg-sky-400/10 text-xs tracking-[0.15em] uppercase disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approve
            </button>
            <button
              onClick={() => runBulk("deliver")}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10 text-xs tracking-[0.15em] uppercase disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
              Mark delivered
            </button>
            <button
              onClick={() => runBulk("cancel")}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 text-xs tracking-[0.15em] uppercase disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              Cancel
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={busy}
              className="px-3 py-2 rounded-md border border-white/15 hover:border-white/40 text-xs tracking-[0.15em] uppercase disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {lastResult && lastResult.failed === 0 && (
        <p className="text-xs text-emerald-300">
          {lastResult.succeeded} order{lastResult.succeeded === 1 ? "" : "s"}{" "}
          {lastResult.action === "approve"
            ? "approved"
            : lastResult.action === "deliver"
              ? "marked delivered"
              : "cancelled"}
          .
        </p>
      )}

      {lastResult && lastResult.failed > 0 && (
        <div className="glass rounded-xl p-3 flex flex-col gap-1.5">
          <p className="text-xs text-white/80">
            {lastResult.succeeded} succeeded, {lastResult.failed} failed:
          </p>
          <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {lastResult.results
              .filter((r) => !r.ok)
              .map((r) => (
                <li key={r.id} className="text-[11px] text-[var(--accent)]">
                  <span className="font-mono text-white/60">#{r.id.slice(0, 8)}</span>{" "}
                  {r.error ?? "Unknown error"}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-2xl p-2 sm:p-4">
        {loading && !orders ? (
          <div className="flex items-center justify-center py-16 text-white/40">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/50 py-8 text-center">
            No orders match these filters.
          </p>
        ) : (
          <>
            {/* Mobile: select-all + stacked order cards */}
            <div className="md:hidden flex flex-col gap-2">
              <label className="flex items-center gap-2 px-1 pb-2 text-[10px] tracking-[0.2em] uppercase text-white/40">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="accent-white"
                />
                Select all ({filtered.length})
              </label>
              {filtered.map((o) => {
                const isSel = selected.has(o.id);
                return (
                  <div
                    key={o.id}
                    className={`rounded-xl border p-3 flex gap-3 transition ${
                      isSel
                        ? "border-white/30 bg-white/[0.07]"
                        : "border-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(o.id)}
                      aria-label={`Select order ${o.id.slice(0, 8)}`}
                      className="accent-white mt-1 shrink-0"
                    />
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex-1 min-w-0 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-white/60">
                          #{o.id.slice(0, 8)}
                        </span>
                        <span className="text-sm font-medium">
                          {fmtEgp(o.subtotal)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-white/90 truncate">
                          {o.customerName || "—"}
                        </div>
                        <div className="text-xs text-white/40 truncate">
                          {o.customerPhone || "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={o.status} />
                        <CarrierBadge carrier={o.carrier} />
                        <span className="text-[11px] text-white/50">
                          {o.governorate || "—"} · {o.itemCount} item
                          {o.itemCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/40">
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString()
                          : "—"}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* Desktop: full sortable table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                <tr className="text-[10px] tracking-[0.2em] uppercase text-white/40 border-b border-white/10">
                  <th className="py-2 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                      className="accent-white"
                    />
                  </th>
                  <th className="text-left py-2 pr-4">Order</th>
                  <th className="text-left py-2 pr-4">Customer</th>
                  <th className="text-left py-2 pr-4">Items</th>
                  <SortableTh
                    label="Governorate"
                    active={sortKey === "governorate"}
                    dir={sortDir}
                    onClick={() => setSort("governorate")}
                  />
                  <SortableTh
                    label="Carrier"
                    active={sortKey === "carrier"}
                    dir={sortDir}
                    onClick={() => setSort("carrier")}
                  />
                  <SortableTh
                    label="Status"
                    active={sortKey === "status"}
                    dir={sortDir}
                    onClick={() => setSort("status")}
                  />
                  <SortableTh
                    label="Date"
                    active={sortKey === "date"}
                    dir={sortDir}
                    onClick={() => setSort("date")}
                  />
                  <SortableTh
                    label="Total"
                    align="right"
                    active={sortKey === "total"}
                    dir={sortDir}
                    onClick={() => setSort("total")}
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const isSel = selected.has(o.id);
                  return (
                    <tr
                      key={o.id}
                      className={`border-b border-white/5 transition ${
                        isSel ? "bg-white/[0.07]" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="py-3 px-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(o.id)}
                          aria-label={`Select order ${o.id.slice(0, 8)}`}
                          className="accent-white"
                        />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-white/70">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="hover:text-white"
                        >
                          #{o.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Link href={`/admin/orders/${o.id}`} className="block">
                          <div className="text-white/90">{o.customerName || "—"}</div>
                          <div className="text-xs text-white/40">{o.customerPhone || "—"}</div>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-white/80">{o.itemCount}</td>
                      <td className="py-3 pr-4 text-white/80">{o.governorate || "—"}</td>
                      <td className="py-3 pr-4">
                        <CarrierBadge carrier={o.carrier} />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3 pr-4 text-xs text-white/60">
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 text-right">{fmtEgp(o.subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-white/40 inline-flex items-center gap-1.5">
        <Truck size={12} />
        Cairo / Giza route to Droppin; all other governorates route to ShipBlu
        (dispatch pending its API).
      </p>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`py-2 ${align === "right" ? "text-right pl-4" : "text-left pr-4"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 tracking-[0.2em] uppercase text-[10px] transition hover:text-white ${
          active ? "text-white" : "text-white/40"
        }`}
      >
        {label}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
