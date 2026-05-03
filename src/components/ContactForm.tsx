"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";

export default function ContactForm() {
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({ name: "", email: "", message: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not send message");
      setData({ name: "", email: "", message: "" });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="glass rounded-2xl p-7 flex flex-col gap-4"
    >
      <h3 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Send a message
      </h3>
      <input
        required
        placeholder="Name"
        value={data.name}
        onChange={(e) => setData({ ...data, name: e.target.value })}
        className="bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition"
      />
      <input
        type="email"
        required
        placeholder="Email"
        value={data.email}
        onChange={(e) => setData({ ...data, email: e.target.value })}
        className="bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition"
      />
      <textarea
        required
        placeholder="Tell us what you need..."
        rows={5}
        value={data.message}
        onChange={(e) => setData({ ...data, message: e.target.value })}
        className="bg-white/5 border border-white/15 rounded-md p-4 outline-none focus:border-white/40 transition resize-none"
      />
      <button
        type="submit"
        disabled={submitting}
        className="self-start inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            Sending <Loader2 size={14} className="animate-spin" />
          </>
        ) : (
          <>
            Send <Send size={14} />
          </>
        )}
      </button>
      {error && <p className="text-xs text-[var(--accent)]">{error}</p>}
      {done && !error && (
        <p className="text-xs text-white/60">
          Thanks — we&apos;ll get back to you soon.
        </p>
      )}
    </form>
  );
}
