"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, PackageCheck, XCircle } from "lucide-react";
import type { OrderStatus } from "@/lib/order-status";

type Action = "approve" | "deliver" | "cancel";

export default function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    const label =
      action === "approve" ? "Approve" : action === "deliver" ? "Mark delivered" : "Cancel";
    if (!confirm(`${label} this order?`)) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/${action}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `${label} failed`);
      if (action === "approve" && data?.dispatch && !data.dispatch.ok) {
        // Approval succeeded but the carrier push didn't — surface it, don't fail.
        setError(`Approved, but dispatch did not complete: ${data.dispatch.error}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  const canApprove = status === "pending";
  const canDeliver = status === "approved";
  const canCancel = status !== "cancelled" && status !== "delivered";

  if (!canApprove && !canDeliver && !canCancel) {
    return (
      <p className="text-sm text-white/50">
        No further actions available for a {status} order.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button
            onClick={() => run("approve")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-sky-400/40 text-sky-300 hover:bg-sky-400/10 text-xs tracking-[0.2em] uppercase disabled:opacity-50 transition"
          >
            {busy === "approve" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Approve
          </button>
        )}
        {canDeliver && (
          <button
            onClick={() => run("deliver")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10 text-xs tracking-[0.2em] uppercase disabled:opacity-50 transition"
          >
            {busy === "deliver" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <PackageCheck size={14} />
            )}
            Mark delivered
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => run("cancel")}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 text-xs tracking-[0.2em] uppercase disabled:opacity-50 transition"
          >
            {busy === "cancel" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <XCircle size={14} />
            )}
            Cancel
          </button>
        )}
      </div>
      {canApprove && (
        <p className="text-[11px] text-white/40">
          Approving deducts stock and dispatches Cairo / Giza orders to Droppin.
        </p>
      )}
      {error && <p className="text-sm text-amber-300/90">{error}</p>}
    </div>
  );
}
