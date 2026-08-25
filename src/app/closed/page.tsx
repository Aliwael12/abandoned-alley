"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SITE_UNLOCK_AT } from "@/lib/site-lock";
import { InstagramIcon, TiktokIcon } from "@/components/Socials";

const Logo3D = dynamic(() => import("@/components/Logo3D"), { ssr: false });

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
    <div className="flex flex-col items-center gap-1">
      <span className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tabular-nums tracking-wider">
        {remaining ? String(value).padStart(2, "0") : "--"}
      </span>
      <span className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-white/50">
        {label}
      </span>
    </div>
  );

  return (
    <section className="relative min-h-[calc(100vh-100px)] flex flex-col items-center justify-between py-12 px-6 text-center">
      <div className="flex-1" />

      <div className="flex flex-col items-center gap-8 z-[2]">
        <Logo3D size={170} rotationSpeed="80deg" controls />

        <div className="flex flex-col items-center gap-3">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
            We&apos;ll be right back
          </p>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tracking-[0.1em]">
            ABANDONED ALLEY IS CLOSED
          </h1>
          <p className="font-[family-name:var(--font-rajdhani)] text-white/70 max-w-md">
             We&apos;re back on August 26 at 12:00 PM.
          </p>
        </div>

        <div className="flex items-center gap-5 md:gap-10">
          {unit(remaining?.days ?? 0, "Days")}
          {unit(remaining?.hours ?? 0, "Hours")}
          {unit(remaining?.minutes ?? 0, "Min")}
          {unit(remaining?.seconds ?? 0, "Sec")}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-end justify-end w-full" />

      <div className="flex flex-col items-center gap-3 z-[2] mt-8">
        <div className="flex gap-5 text-white/90">
          <a
            href="https://instagram.com/abandonedalley.eg/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hover:scale-110 transition"
          >
            <InstagramIcon />
          </a>
          <a
            href="https://www.tiktok.com/@abandonedalley.eg"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="hover:scale-110 transition"
          >
            <TiktokIcon />
          </a>
        </div>
        <div className="flex flex-col items-center text-[11px] tracking-[0.3em] uppercase text-white/70 gap-0.5">
          <p>&copy; 2026 Abandoned Alley</p>
        </div>
      </div>
    </section>
  );
}
