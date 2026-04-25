"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InstagramIcon, YoutubeIcon, TiktokIcon } from "./Socials";

const Logo3D = dynamic(() => import("./Logo3D"), { ssr: false });

const MENU = [
  { href: "/shop", label: "SHOP" },
  { href: "/contact", label: "Contact" },
  { href: "/collections", label: "COLLECTIONS" },
];

export default function EnterPage() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-[calc(100vh-100px)] flex flex-col items-center justify-between py-12 px-6 text-center">
      <div className="flex-1" />

      <div className="flex flex-col items-center gap-6 z-[2]">
        <Logo3D size={170} rotationSpeed="80deg" controls />

        <div className="font-[family-name:var(--font-rajdhani)] text-white/90 text-base tracking-[0.08em]">
          {now ? (
            <>
              <span className="mx-2">{now.toLocaleDateString()}</span>
              <span className="mx-2">{now.toLocaleTimeString()}</span>
            </>
          ) : (
            <span className="opacity-0">--/--/----</span>
          )}
        </div>

        <div className="menu-anim flex flex-col gap-2 mt-2">
          {MENU.map((item) => (
            <Link key={item.href} href={item.href} className="enter-btn group">
              <span className="btn-text">{item.label}</span>
              <span className="arrow arrow-flow">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M 4 5 H 8 L 14 12 L 8 19 H 4 L 10 12 Z" />
                  <path d="M 10 5 H 14 L 20 12 L 14 19 H 10 L 16 12 Z" />
                </svg>
              </span>
              <span className="wave" />
            </Link>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-end justify-end w-full" />

      <div className="flex flex-col items-center gap-3 z-[2] mt-8">
        <div className="flex gap-5 text-white/90">
          <a
            href="https://instagram.com/abandonedalley/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="hover:scale-110 transition"
          >
            <InstagramIcon />
          </a>
          <a
            href="https://youtube.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube"
            className="hover:scale-110 transition"
          >
            <YoutubeIcon />
          </a>
          <a
            href="https://www.tiktok.com/@abandonedalley"
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
          <Link href="/policies" className="hover:opacity-70 transition">
            TERMS AND POLICIES
          </Link>
        </div>
      </div>
    </section>
  );
}
