"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Truck } from "lucide-react";

export default function PushToDroppinButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function push() {
    setPushing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/push-droppin`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Push failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
      setPushing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={push}
        disabled={pushing}
        style={{ color: "#000" }}
        className="self-start bg-white px-5 py-2.5 rounded-md text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2 hover:bg-white/90 transition"
      >
        {pushing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Truck size={14} />
        )}
        {pushing ? "Pushing…" : "Push to Droppin"}
      </button>
      {error && <p className="text-sm text-red-300/90">{error}</p>}
    </div>
  );
}
