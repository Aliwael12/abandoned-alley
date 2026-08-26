"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

export default function BroadcastTab({ onError }: { onError: (msg: string) => void }) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Send failed");
      setResult(
        data.sent
          ? `Sent to ${data.sent} subscriber${data.sent === 1 ? "" : "s"}.`
          : data.message ?? "Done."
      );
      setSubject("");
      setHtml("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-12 px-4 outline-none focus:border-[var(--border-strong)] transition w-full";

  return (
    <div className="glass  p-6 flex flex-col gap-4 max-w-3xl">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Send a promo
      </h2>
      <input
        placeholder="Subject line"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className={inputCls}
      />
      <textarea
        placeholder="Write your promo email here. HTML is supported — drop in headings, links, and images to style it."
        rows={14}
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  p-4 outline-none focus:border-[var(--border-strong)] transition resize-none font-mono text-sm"
      />
      <button
        onClick={send}
        disabled={submitting || !subject || !html}
        style={{ color: "var(--text-on-accent)" }}
        className="self-start bg-[var(--accent-default)] px-6 py-3  font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {submitting ? "Sending…" : "Broadcast"}
      </button>
      {result && <p className="text-sm text-[var(--text-muted)]">{result}</p>}
    </div>
  );
}
