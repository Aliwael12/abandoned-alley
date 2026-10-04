"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { utcToZonedInput, zonedTimeToUtc } from "@/lib/cairo-time";
import { isOfferLive, type OfferConfig } from "@/lib/offer";

type Form = {
  enabled: boolean;
  start: string;
  end: string;
  freeDeliveryAt: string;
  discountAt: string;
  discountAmount: string;
};

function toForm(o: OfferConfig): Form {
  return {
    enabled: o.enabled,
    start: o.startsAt ? utcToZonedInput(o.startsAt) : "",
    end: o.endsAt ? utcToZonedInput(o.endsAt) : "",
    freeDeliveryAt: String(o.freeDeliveryAt),
    discountAt: String(o.discountAt),
    discountAmount: String(o.discountAmount),
  };
}

function toConfig(f: Form): OfferConfig {
  return {
    enabled: f.enabled,
    startsAt: f.start ? zonedTimeToUtc(f.start) : null,
    endsAt: f.end ? zonedTimeToUtc(f.end) : null,
    freeDeliveryAt: Number(f.freeDeliveryAt),
    discountAt: Number(f.discountAt),
    discountAmount: Number(f.discountAmount),
  };
}

/** One line on whether shoppers see the offer right now, from what's saved. */
function statusOf(o: OfferConfig): string {
  if (isOfferLive(o, "eg")) return "Live now — Egypt shoppers see it.";
  if (!o.enabled) return "Off — nobody sees it.";
  if (o.startsAt !== null && Date.now() < o.startsAt) return "Scheduled — starts on the start date.";
  return "Ended — the end date has passed.";
}

/**
 * The Egypt spend offer: on/off, its dates (Cairo time), and its numbers.
 * Changes apply to the live store on save — no deploy.
 */
export default function OfferSettings({ onError }: { onError: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<OfferConfig | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/offer", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? "Load failed");
        return data as OfferConfig;
      })
      .then((o) => {
        if (cancelled) return;
        setSaved(o);
        setForm(toForm(o));
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSavedAt(null);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/offer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toConfig(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      setSaved(data as OfferConfig);
      setForm(toForm(data as OfferConfig));
      setSavedAt(Date.now());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-10 px-3 text-sm outline-none focus:border-[var(--border-strong)] transition w-full";
  const labelCls = "text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]";

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Spend offer (Egypt)
      </h2>

      <div className="glass  p-6 flex flex-col gap-5">
        {saved && <p className="text-sm">{statusOf(saved)}</p>}

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form?.enabled ?? false}
            onChange={(e) => update("enabled", e.target.checked)}
            disabled={loading}
          />
          <span className={labelCls}>Offer on</span>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Starts (Cairo time)</span>
            <input
              type="datetime-local"
              value={form?.start ?? ""}
              onChange={(e) => update("start", e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Ends (Cairo time)</span>
            <input
              type="datetime-local"
              value={form?.end ?? ""}
              onChange={(e) => update("end", e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </label>
        </div>
        <span className="text-xs text-[var(--text-muted)] -mt-3">
          Leave a date empty for no limit on that side.
        </span>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Free delivery at (EGP)</span>
            <input
              type="number"
              min="1"
              value={form?.freeDeliveryAt ?? ""}
              onChange={(e) => update("freeDeliveryAt", e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Discount at (EGP)</span>
            <input
              type="number"
              min="1"
              value={form?.discountAt ?? ""}
              onChange={(e) => update("discountAt", e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Discount (EGP off)</span>
            <input
              type="number"
              min="1"
              value={form?.discountAmount ?? ""}
              onChange={(e) => update("discountAmount", e.target.value)}
              disabled={loading}
              className={inputCls}
            />
          </label>
        </div>
        <span className="text-xs text-[var(--text-muted)] -mt-3">
          Based on the products total, before delivery. The discount tier also gets free
          delivery. A promo code never stacks with the offer — the customer gets whichever
          saves more.
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading || !form}
            style={{ color: "var(--text-on-accent)" }}
            className="bg-[var(--accent-default)] px-5 py-2.5  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save offer
          </button>
          {savedAt && (
            <span className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
              <Check size={12} />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
