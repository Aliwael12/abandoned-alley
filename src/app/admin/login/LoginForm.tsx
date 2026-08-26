"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Login failed");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        required
        type="password"
        autoFocus
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-12 px-4 outline-none focus:border-[var(--border-strong)] transition"
      />
      {error && <p className="text-xs text-[var(--accent)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        style={{ color: "var(--text-on-accent)" }}
        className="bg-[var(--accent-default)] py-3  font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase hover:bg-[var(--accent-hover)] transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="animate-spin" size={14} />}
        {submitting ? "Signing in…" : "Enter"}
      </button>
    </form>
  );
}
