"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type Props = {
  onError: (msg: string) => void;
};

export default function SettingsTab({ onError }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [metro, setMetro] = useState("");
  const [outer, setOuter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? "Load failed");
        return (await r.json()) as {
          metroShippingFee: number;
          outerShippingFee: number;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setMetro(String(data.metroShippingFee ?? 0));
        setOuter(String(data.outerShippingFee ?? 0));
      })
      .catch((err) => {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  async function save() {
    const m = Number(metro);
    const o = Number(outer);
    if (!Number.isFinite(m) || m < 0 || !Number.isFinite(o) || o < 0) {
      onError("Enter valid non-negative numbers");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metroShippingFee: m, outerShippingFee: o }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");
      setSavedAt(Date.now());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "bg-white/5 border border-white/15 rounded-md h-10 px-3 text-sm outline-none focus:border-white/40 transition w-full";

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Store settings
      </h2>

      <div className="glass rounded-2xl p-6 flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
            Cairo / Giza shipping fee (EGP)
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={metro}
            onChange={(e) => {
              setMetro(e.target.value);
              setSavedAt(null);
            }}
            disabled={loading}
            className={inputCls}
          />
          <span className="text-xs text-white/50">
            Orders to Cairo or Giza. Pushed to Droppin automatically.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.3em] uppercase text-white/60">
            Other governorates shipping fee (EGP)
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={outer}
            onChange={(e) => {
              setOuter(e.target.value);
              setSavedAt(null);
            }}
            disabled={loading}
            className={inputCls}
          />
          <span className="text-xs text-white/50">
            Orders to any other Egyptian governorate (3–5 business days). Pushed
            to Droppin manually from the order page.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            style={{ color: "#000" }}
            className="bg-white px-5 py-2.5 rounded-md text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
          {savedAt && (
            <span className="text-xs text-white/60 inline-flex items-center gap-1.5">
              <Check size={12} />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
