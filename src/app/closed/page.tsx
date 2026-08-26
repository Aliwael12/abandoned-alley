"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { SITE_UNLOCK_AT } from "@/lib/site-lock";
import { InstagramIcon } from "@/components/Socials";

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    diff,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1_000) % 60),
  };
}

export default function ClosedPage() {
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemaining> | null>(null);

  useEffect(() => {
    const tick = () => {
      const r = getRemaining(SITE_UNLOCK_AT);
      setRemaining(r);
      if (r.diff <= 0) {
        window.location.reload();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const unit = (value: number, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
      <span className="aa-numeric" style={{ fontSize: "var(--text-4xl)" }}>
        {remaining ? String(value).padStart(2, "0") : "--"}
      </span>
      <span className="aa-caption">{label}</span>
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-8)",
        padding: "var(--space-12) var(--space-6)",
        textAlign: "center",
        background: "var(--surface-page)",
      }}
    >
      <Image src="/brand/logo-solid-black.png" alt="Abandoned Alley" width={140} height={140} priority />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)" }}>
        <div className="aa-eyebrow">WE&apos;LL BE RIGHT BACK</div>
        <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)" }}>
          ABANDONED ALLEY IS CLOSED
        </h1>
        <p className="aa-body" style={{ color: "var(--text-muted)", maxWidth: 420 }}>
          We&apos;re back on August 26 at 12:00 PM.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
        {unit(remaining?.days ?? 0, "DAYS")}
        {unit(remaining?.hours ?? 0, "HOURS")}
        {unit(remaining?.minutes ?? 0, "MIN")}
        {unit(remaining?.seconds ?? 0, "SEC")}
      </div>

      <a href="https://www.instagram.com/aa.collectives/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
        <InstagramIcon size={20} />
      </a>
      <p className="aa-caption">© 2026 ABANDONED ALLEY</p>
    </div>
  );
}
