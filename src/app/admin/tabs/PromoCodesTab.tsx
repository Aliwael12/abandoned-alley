"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { PromoCode } from "@/lib/promo-codes";

type Props = {
  onError: (msg: string) => void;
};

const inputCls =
  "bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-10 px-3 text-sm outline-none focus:border-[var(--border-strong)] transition w-full";

function isExpired(promo: PromoCode): boolean {
  return promo.validUntil !== null && Date.now() > promo.validUntil;
}

function valueLabel(promo: PromoCode): string {
  if (promo.type === "percentage") return `${promo.value}% off`;
  const egp = `EGP ${promo.value.toFixed(2)} off`;
  return promo.valueUsd ? `${egp} · $${promo.valueUsd.toFixed(2)} off (US)` : `${egp} (EG only)`;
}

export default function PromoCodesTab({ onError }: Props) {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [valueUsd, setValueUsd] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/promo-codes", { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json())?.error ?? "Load failed");
    const data = (await res.json()) as { codes: PromoCode[] };
    setCodes(data.codes);
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

  function resetForm() {
    setCode("");
    setType("percentage");
    setValue("");
    setValueUsd("");
    setValidUntil("");
  }

  async function createCode() {
    if (!code.trim()) {
      onError("Enter a code");
      return;
    }
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) {
      onError("Enter a valid discount value");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          value: v,
          valueUsd: type === "fixed" && valueUsd ? Number(valueUsd) : undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Create failed");
      resetForm();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(promo: PromoCode) {
    setBusy(promo.code);
    try {
      const res = await fetch(`/api/admin/promo-codes/${encodeURIComponent(promo.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !promo.active }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Update failed");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(promo: PromoCode) {
    if (!confirm(`Delete promo code "${promo.code}"?`)) return;
    setBusy(promo.code);
    try {
      const res = await fetch(`/api/admin/promo-codes/${encodeURIComponent(promo.code)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Delete failed");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Promo codes
      </h2>

      <div className="glass  p-6 flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SUMMER20"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">Discount type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "percentage" | "fixed")}
              className={inputCls}
            >
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
              {type === "percentage" ? "Percent off" : "Amount off (EGP)"}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={type === "percentage" ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percentage" ? "20" : "100"}
              className={inputCls}
            />
          </label>
          {type === "fixed" && (
            <label className="flex flex-col gap-2">
              <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
                Amount off (USD, optional)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                placeholder="Leave blank to disable for US orders"
                className={inputCls}
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-2 sm:max-w-xs">
          <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
            Valid until (optional)
          </span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputCls}
          />
          <span className="text-xs text-[var(--text-muted)]">Leave blank for no expiry.</span>
        </label>

        <button
          onClick={createCode}
          disabled={creating}
          style={{ color: "var(--text-on-accent)" }}
          className="self-start bg-[var(--accent-default)] px-5 py-2.5  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create code
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : codes.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No promo codes yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left py-2 pr-4">Code</th>
                <th className="text-left py-2 pr-4">Discount</th>
                <th className="text-left py-2 pr-4">Expires</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((promo) => {
                const expired = isExpired(promo);
                return (
                  <tr key={promo.code} className="border-b border-[var(--border-subtle)]">
                    <td className="py-3 pr-4 font-mono">{promo.code}</td>
                    <td className="py-3 pr-4">{valueLabel(promo)}</td>
                    <td className="py-3 pr-4 text-[var(--text-muted)]">
                      {promo.validUntil ? new Date(promo.validUntil).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3 pr-4">
                      {expired ? (
                        <span className="text-[var(--text-muted)]">Expired</span>
                      ) : promo.active ? (
                        <span className="text-[var(--accent-default)]">Active</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">Inactive</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={() => toggleActive(promo)}
                          disabled={busy === promo.code}
                          className="text-xs tracking-[0.15em] uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition disabled:opacity-50"
                        >
                          {promo.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => remove(promo)}
                          disabled={busy === promo.code}
                          aria-label={`Delete ${promo.code}`}
                          className="text-[var(--text-muted)] hover:text-[var(--accent)] transition disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
