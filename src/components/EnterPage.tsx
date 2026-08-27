"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { InstagramIcon } from "./Socials";

const NAV = [
  { href: "/shop", label: "SHOP" },
  { href: "/collections", label: "COLLECTIONS" },
  { href: "/contact", label: "CONTACT" },
];

/** Cairo wall-clock stamp, in the 424 landing-page style. */
function useCairoStamp() {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const tick = () => {
      const parts = fmt.formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      const date = `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")}`;
      const time = `${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod")}`;
      setStamp(`CAIRO, EG | ${date.toUpperCase()} | ${time} EET`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return stamp;
}

export default function EnterPage() {
  const stamp = useCairoStamp();
  const cartItems = useCart((s) => s.items);
  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8) var(--space-6)",
        background: "var(--surface-page)",
        textAlign: "center",
        position: "relative",
      }}
    >
      <Image
        src="/brand/logo-season-star-purple-yellow.jpg"
        alt="Abandoned Alley"
        width={420}
        height={420}
        priority
        style={{
          width: "min(52vw, 34vh, 340px)",
          height: "min(52vw, 34vh, 340px)",
          objectFit: "cover",
          clipPath: "inset(0 0 2% 0)",
        }}
      />

      {/* Primary navigation — the landing page is the menu */}
      <nav
        className="aa-enter-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "var(--space-8)",
          marginTop: "var(--space-8)",
        }}
      >
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="aa-enter-link">
            {item.label}
          </Link>
        ))}
        <Link href="/cart" className="aa-enter-link">
          BAG{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </nav>

      <div
        className="aa-body"
        style={{
          fontWeight: 600,
          letterSpacing: "var(--tracking-label)",
          color: "var(--text-primary)",
          marginTop: "var(--space-8)",
        }}
      >
        FRIDAY · 04 SEPTEMBER 2026 · 20:00 CAIRO
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          marginTop: "var(--space-4)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <a
          href="https://www.instagram.com/aa.collectives/"
          target="_blank"
          rel="noopener noreferrer"
          className="aa-body"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            color: "var(--text-primary)",
          }}
        >
          <InstagramIcon size={18} /> @AA.COLLECTIVES
        </a>
      </div>

      {/* Live Cairo stamp, pinned to the bottom like the reference layout */}
      <div
        className="aa-caption aa-enter-stamp"
        style={{
          position: "absolute",
          bottom: "var(--space-6)",
          left: 0,
          right: 0,
          color: "var(--text-muted)",
        }}
      >
        {stamp ?? " "}
      </div>
    </div>
  );
}
