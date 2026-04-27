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
    "bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition w-full";

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <div className="glass rounded-2xl p-6 flex flex-col gap-4">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Send a promo
        </h2>
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputCls}
        />
        <textarea
          placeholder="<h1>Sale</h1><p>20% off everything…</p>  (HTML)"
          rows={14}
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="bg-white/5 border border-white/15 rounded-md p-4 outline-none focus:border-white/40 transition resize-none font-mono text-sm"
        />
        <button
          onClick={send}
          disabled={submitting || !subject || !html}
          style={{ color: "#000" }}
          className="self-start bg-white px-6 py-3 rounded-md font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submitting ? "Sending…" : "Broadcast"}
        </button>
        {result && <p className="text-sm text-white/70">{result}</p>}
      </div>

      <aside className="glass rounded-2xl p-6 flex flex-col gap-3 text-sm text-white/60 leading-relaxed">
        <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.18em] text-white">
          Notes
        </h3>
        <p>
          Sends to every confirmed entry in the <code className="text-white">subscribers</code>
          {" "}collection.
        </p>
        <p>
          Resend&apos;s sandbox <code className="text-white">onboarding@resend.dev</code> only delivers to your own
          Resend-account email. Verify a domain at{" "}
          <a className="underline" href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">
            resend.com/domains
          </a>{" "}
          and update <code className="text-white">EMAIL_FROM</code> in <code className="text-white">.env.local</code>{" "}
          before broadcasting for real.
        </p>
        <p>Plain HTML for now — paste your marketing template into the body field.</p>
      </aside>
    </div>
  );
}
