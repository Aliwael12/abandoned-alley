"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import type { Product } from "@/lib/products";
import type { SizeChart } from "@/lib/size-charts";

type ChartWithAssignments = SizeChart & {
  assignedProductHandles: string[];
};

type DraftColumn = { id: string; label: string };

type DraftRow = {
  size: string;
  measurements: Record<string, string>;
};

type ChartDraft = {
  name: string;
  columns: DraftColumn[];
  rows: DraftRow[];
  note: string;
  assigned: Set<string>;
};

let columnIdSeq = 0;
function newColumnId() {
  columnIdSeq += 1;
  return `col-${Date.now()}-${columnIdSeq}`;
}

function uniqueMeasurementLabel(existing: string[]) {
  let n = 1;
  let label = `Measurement ${n}`;
  while (existing.includes(label)) {
    n += 1;
    label = `Measurement ${n}`;
  }
  return label;
}

function chartToDraft(chart: ChartWithAssignments): ChartDraft {
  const columns =
    chart.columnDefs && chart.columnDefs.length > 0
      ? chart.columnDefs.map((c, i) => ({
          id: c.id || `${chart.handle}-c${i}`,
          label: c.label ?? "",
        }))
      : chart.columns.map((label, i) => ({
          id: `${chart.handle}-c${i}`,
          label,
        }));
  return {
    name: chart.name,
    columns,
    rows: chart.rows.map((r) => ({
      size: r.size,
      measurements: Object.fromEntries(
        columns.map((c) => [c.id, r.measurements[c.label] ?? ""])
      ),
    })),
    note: chart.note ?? "",
    assigned: new Set(chart.assignedProductHandles),
  };
}

function draftToSaveBody(d: ChartDraft) {
  return {
    name: d.name,
    columns: d.columns.map((c) => c.label),
    columnDefs: d.columns.map((c) => ({ id: c.id, label: c.label })),
    rows: d.rows.map((r) => ({
      size: r.size,
      measurements: Object.fromEntries(
        d.columns.map((c) => [c.label, r.measurements[c.id] ?? ""])
      ),
    })),
    note: d.note,
  };
}

function emptyDraftRow(columns: DraftColumn[]): DraftRow {
  return {
    size: "",
    measurements: Object.fromEntries(columns.map((c) => [c.id, ""])),
  };
}

type Props = {
  products: Product[];
  onChanged: () => void | Promise<void>;
  onError: (msg: string) => void;
};

const inputCls =
  "bg-white/5 border border-white/15 rounded-md h-10 px-3 text-sm outline-none focus:border-white/40 transition w-full";

const cellCls =
  "bg-white/5 border border-white/15 rounded-md h-9 px-2 text-sm outline-none focus:border-white/40 transition w-full min-w-[4rem]";

export default function SizeChartsTab({ products, onChanged, onError }: Props) {
  const [charts, setCharts] = useState<ChartWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [defaultChart, setDefaultChart] = useState("");
  const [defaultSavedAt, setDefaultSavedAt] = useState<number | null>(null);

  const [drafts, setDrafts] = useState<Record<string, ChartDraft>>({});

  const load = useCallback(async () => {
    const [chartsRes, settingsRes] = await Promise.all([
      fetch("/api/admin/size-charts", { cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
    ]);
    if (!chartsRes.ok) {
      throw new Error((await chartsRes.json())?.error ?? "Load failed");
    }
    const data = (await chartsRes.json()) as { charts: ChartWithAssignments[] };
    setCharts(data.charts);
    if (settingsRes.ok) {
      const s = (await settingsRes.json()) as { defaultSizeChartHandle?: string | null };
      setDefaultChart(s.defaultSizeChartHandle ?? "");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, onError]);

  function updateDraft(
    handle: string,
    patch: Partial<{
      name: string;
      columns: DraftColumn[];
      rows: DraftRow[];
      note: string;
      assigned: Set<string>;
    }>
  ) {
    setDrafts((prev) => {
      const cur = prev[handle];
      if (!cur) return prev;
      return { ...prev, [handle]: { ...cur, ...patch } };
    });
  }

  async function createChart() {
    const name = newName.trim();
    if (!name) return;
    setBusy("__new__");
    try {
      const res = await fetch("/api/admin/size-charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await res.json()) as {
        chart?: ChartWithAssignments;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Create failed");
      const chart = payload.chart;
      setCreating(false);
      setNewName("");
      await load();
      await onChanged();
      if (chart?.handle) {
        setExpanded(chart.handle);
        setDrafts((prev) => ({
          ...prev,
          [chart.handle]: chartToDraft({ ...chart, assignedProductHandles: [] }),
        }));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveChart(handle: string) {
    const d = drafts[handle];
    if (!d) return;
    if (d.columns.length === 0) {
      onError("Add at least one measurement column before saving");
      return;
    }
    setBusy(handle);
    try {
      const res = await fetch(`/api/admin/size-charts/${handle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draftToSaveBody(d),
          assignedProductHandles: [...d.assigned],
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[handle];
        return next;
      });
      await load();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeChart(handle: string, name: string) {
    if (!confirm(`Delete size chart "${name}"? Assigned products will lose their chart.`)) {
      return;
    }
    setBusy(handle);
    try {
      const res = await fetch(`/api/admin/size-charts/${handle}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Delete failed");
      if (defaultChart === handle) setDefaultChart("");
      await load();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveDefault() {
    setBusy("__default__");
    try {
      const settingsRes = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!settingsRes.ok) throw new Error("Could not load settings");
      const current = (await settingsRes.json()) as {
        metroShippingFee: number;
        outerShippingFee: number;
      };
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metroShippingFee: current.metroShippingFee,
          outerShippingFee: current.outerShippingFee,
          defaultSizeChartHandle: defaultChart,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");
      setDefaultSavedAt(Date.now());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  function renameColumn(handle: string, index: number, nextLabel: string) {
    const d = drafts[handle];
    if (!d) return;
    const columns = d.columns.map((col, i) =>
      i === index ? { ...col, label: nextLabel } : col
    );
    updateDraft(handle, { columns });
  }

  function addColumn(handle: string) {
    const d = drafts[handle];
    if (!d) return;
    const label = uniqueMeasurementLabel(d.columns.map((c) => c.label));
    const col: DraftColumn = { id: newColumnId(), label };
    const columns = [...d.columns, col];
    const rows = d.rows.map((row) => ({
      ...row,
      measurements: { ...row.measurements, [col.id]: "" },
    }));
    updateDraft(handle, { columns, rows });
  }

  function removeColumn(handle: string, index: number) {
    const d = drafts[handle];
    if (!d) return;
    const removedId = d.columns[index]?.id;
    if (!removedId) return;
    const columns = d.columns.filter((_, i) => i !== index);
    const rows = d.rows.map((row) => {
      const measurements = { ...row.measurements };
      delete measurements[removedId];
      return { ...row, measurements };
    });
    updateDraft(handle, { columns, rows });
  }

  function addRow(handle: string) {
    const d = drafts[handle];
    if (!d) return;
    updateDraft(handle, {
      rows: [...d.rows, emptyDraftRow(d.columns)],
    });
  }

  function removeRow(handle: string, index: number) {
    const d = drafts[handle];
    if (!d || d.rows.length <= 1) return;
    updateDraft(handle, { rows: d.rows.filter((_, i) => i !== index) });
  }

  function toggleProduct(handle: string, productHandle: string) {
    const d = drafts[handle];
    if (!d) return;
    const assigned = new Set(d.assigned);
    if (assigned.has(productHandle)) assigned.delete(productHandle);
    else assigned.add(productHandle);
    updateDraft(handle, { assigned });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Size charts ({charts.length})
        </h2>
        <button
          onClick={() => setCreating((v) => !v)}
          style={{ color: creating ? undefined : "#000" }}
          className={
            creating
              ? "inline-flex items-center gap-2 px-4 py-2 border border-white/15 hover:border-white/40 rounded-md text-xs tracking-[0.2em] uppercase transition"
              : "inline-flex items-center gap-2 px-4 py-2 bg-white rounded-md text-xs tracking-[0.2em] uppercase transition"
          }
        >
          {creating ? <X size={14} /> : <Plus size={14} />}
          {creating ? "Cancel" : "New chart"}
        </button>
      </div>

      <div className="glass rounded-2xl p-6 flex flex-col gap-4 max-w-xl">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/60">
          Default chart for new products
        </p>
        <select
          value={defaultChart}
          onChange={(e) => {
            setDefaultChart(e.target.value);
            setDefaultSavedAt(null);
          }}
          className={inputCls}
        >
          <option value="">None</option>
          {charts.map((c) => (
            <option key={c.handle} value={c.handle}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <button
            onClick={saveDefault}
            disabled={busy === "__default__"}
            style={{ color: "#000" }}
            className="bg-white px-5 py-2.5 rounded-md text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy === "__default__" && <Loader2 size={14} className="animate-spin" />}
            Save default
          </button>
          {defaultSavedAt && (
            <span className="text-xs text-white/50 inline-flex items-center gap-1">
              <Check size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {creating && (
        <div className="glass rounded-2xl p-6 flex flex-col gap-4 max-w-xl">
          <input
            placeholder="Chart name (e.g. T-shirts, Pants)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={inputCls}
          />
          <button
            onClick={createChart}
            disabled={busy === "__new__" || !newName.trim()}
            style={{ color: "#000" }}
            className="self-start bg-white px-5 py-2.5 rounded-md text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy === "__new__" && <Loader2 size={14} className="animate-spin" />}
            Create chart
          </button>
        </div>
      )}

      {charts.length === 0 ? (
        <p className="text-sm text-white/50 py-6">
          No size charts yet. Create one for shirts, another for pants, then assign
          products below.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {charts.map((chart) => {
            const isOpen = expanded === chart.handle;
            const d = drafts[chart.handle];
            return (
              <li key={chart.handle} className="glass rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const next = isOpen ? null : chart.handle;
                    setExpanded(next);
                    if (next) {
                      setDrafts((prev) => ({
                        ...prev,
                        [chart.handle]: chartToDraft(chart),
                      }));
                    }
                  }}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition"
                >
                  <div>
                    <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.1em]">
                      {chart.name}
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      {chart.assignedProductHandles.length} product
                      {chart.assignedProductHandles.length === 1 ? "" : "s"} ·{" "}
                      {chart.rows.length} sizes · {chart.columns.length} measurements
                    </p>
                  </div>
                  <span className="text-xs tracking-[0.2em] uppercase text-white/40">
                    {isOpen ? "Close" : "Edit"}
                  </span>
                </button>

                {isOpen && d && (
                  <div className="px-6 pb-6 flex flex-col gap-6 border-t border-white/10 pt-6">
                    <label className="flex flex-col gap-2 max-w-md">
                      <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
                        Chart name
                      </span>
                      <input
                        value={d.name}
                        onChange={(e) => updateDraft(chart.handle, { name: e.target.value })}
                        className={inputCls}
                      />
                    </label>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
                          Measurement columns
                        </span>
                        <button
                          type="button"
                          onClick={() => addColumn(chart.handle)}
                          className="text-xs tracking-[0.2em] uppercase text-white/60 hover:text-white"
                        >
                          + Add column
                        </button>
                      </div>
                      <ul className="flex flex-col gap-2 max-w-lg">
                        {d.columns.length === 0 && (
                          <li className="text-xs text-white/50">
                            No measurement columns — add one below or save will be
                            blocked until you do.
                          </li>
                        )}
                        {d.columns.map((col, i) => (
                          <li key={col.id} className="flex gap-2">
                            <input
                              value={col.label ?? ""}
                              onChange={(e) =>
                                renameColumn(chart.handle, i, e.target.value)
                              }
                              className={inputCls}
                              placeholder="e.g. Chest (cm)"
                            />
                            <button
                              type="button"
                              onClick={() => removeColumn(chart.handle, i)}
                              className="px-3 border border-white/15 rounded-md text-xs hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              aria-label="Remove column"
                            >
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-col gap-3 overflow-x-auto">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
                          Size rows
                        </span>
                        <button
                          type="button"
                          onClick={() => addRow(chart.handle)}
                          className="text-xs tracking-[0.2em] uppercase text-white/60 hover:text-white"
                        >
                          + Add size
                        </button>
                      </div>
                      <table className="w-full text-sm border-collapse min-w-[480px]">
                        <thead>
                          <tr>
                            <th className="text-left pb-2 pr-2 text-[10px] tracking-[0.2em] uppercase text-white/50 font-normal w-24">
                              Size
                            </th>
                            {d.columns.map((col) => (
                              <th
                                key={col.id}
                                className="text-left pb-2 pr-2 text-[10px] tracking-[0.15em] uppercase text-white/50 font-normal"
                              >
                                {col.label}
                              </th>
                            ))}
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {d.rows.map((row, ri) => (
                            <tr key={ri}>
                              <td className="pr-2 pb-2">
                                <input
                                  value={row.size}
                                  onChange={(e) => {
                                    const rows = d.rows.slice();
                                    rows[ri] = { ...row, size: e.target.value };
                                    updateDraft(chart.handle, { rows });
                                  }}
                                  className={cellCls}
                                  placeholder="S"
                                />
                              </td>
                              {d.columns.map((col) => (
                                <td key={col.id} className="pr-2 pb-2">
                                  <input
                                    value={row.measurements[col.id] ?? ""}
                                    onChange={(e) => {
                                      const rows = d.rows.slice();
                                      rows[ri] = {
                                        ...row,
                                        measurements: {
                                          ...row.measurements,
                                          [col.id]: e.target.value,
                                        },
                                      };
                                      updateDraft(chart.handle, { rows });
                                    }}
                                    className={cellCls}
                                    placeholder="—"
                                  />
                                </td>
                              ))}
                              <td className="pb-2">
                                <button
                                  type="button"
                                  onClick={() => removeRow(chart.handle, ri)}
                                  disabled={d.rows.length <= 1}
                                  className="p-2 border border-white/15 rounded-md disabled:opacity-30 hover:border-[var(--accent)]"
                                  aria-label="Remove row"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <label className="flex flex-col gap-2 max-w-xl">
                      <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
                        Fit note (optional)
                      </span>
                      <textarea
                        rows={2}
                        value={d.note}
                        onChange={(e) => updateDraft(chart.handle, { note: e.target.value })}
                        className="bg-white/5 border border-white/15 rounded-md p-3 text-sm outline-none focus:border-white/40 transition resize-none"
                        placeholder="e.g. Measurements are flat lay. Size up for oversized fit."
                      />
                    </label>

                    <div className="flex flex-col gap-3">
                      <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
                        Assign to products
                      </span>
                      {products.length === 0 ? (
                        <p className="text-xs text-white/50">No products in catalog yet.</p>
                      ) : (
                        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {products.map((p) => (
                            <li key={p.handle}>
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-white/90">
                                <input
                                  type="checkbox"
                                  checked={d.assigned.has(p.handle)}
                                  onChange={() => toggleProduct(chart.handle, p.handle)}
                                  className="rounded border-white/30"
                                />
                                <span className="truncate">{p.title}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => saveChart(chart.handle)}
                        disabled={busy === chart.handle || !d.name.trim()}
                        style={{ color: "#000" }}
                        className="px-5 py-2.5 bg-white rounded-md text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {busy === chart.handle && (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                        Save chart
                      </button>
                      <button
                        onClick={() => removeChart(chart.handle, chart.name)}
                        disabled={busy === chart.handle}
                        className="px-4 py-2.5 border border-white/15 hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-md text-xs tracking-[0.2em] uppercase inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [chart.handle]: chartToDraft(chart),
                          }))
                        }
                        className="px-4 py-2.5 border border-white/15 rounded-md text-xs tracking-[0.2em] uppercase"
                      >
                        Reset changes
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
