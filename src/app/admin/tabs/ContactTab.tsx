"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: number | null;
};

type Props = {
  onError: (msg: string) => void;
};

export default function ContactTab({ onError }: Props) {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/contact", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error ?? "Load failed");
        return (await r.json()) as { messages: ContactMessage[] };
      })
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
      })
      .catch((err: unknown) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/40">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const list = messages ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
        Contact messages ({list.length})
      </h2>

      {list.length === 0 ? (
        <p className="text-sm text-white/50 py-6">No messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((m) => (
            <li key={m.id} className="glass rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.1em] truncate">
                    {m.name}
                  </h3>
                  <a
                    href={`mailto:${m.email}`}
                    className="text-xs text-white/70 hover:text-white transition inline-flex items-center gap-1.5 truncate"
                  >
                    <Mail size={12} />
                    {m.email}
                  </a>
                </div>
                <span className="text-xs text-white/40 font-mono shrink-0">
                  {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                </span>
              </div>
              <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                {m.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
