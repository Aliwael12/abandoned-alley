"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRegion } from "@/lib/region";
import { Button } from "./ui";
import { InstagramIcon } from "./Socials";

export default function EnterPage() {
  const router = useRouter();
  const region = useRegion((s) => s.region);

  const enter = () => {
    router.push(region ? "/home" : "/region");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        padding: "var(--space-8) var(--space-6)",
        background: "var(--surface-page)",
        textAlign: "center",
      }}
    >
      <Image
        src="/brand/logo-season-star-purple-yellow.jpg"
        alt="Abandoned Alley — seasonal mark"
        width={420}
        height={420}
        style={{
          width: "min(64vw, 42vh, 420px)",
          height: "min(64vw, 42vh, 420px)",
          objectFit: "cover",
          clipPath: "inset(0 0 2% 0)",
        }}
        priority
      />

      <div className="aa-eyebrow" style={{ color: "#5c2ca0" }}>
        DROP 004
      </div>

      <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", color: "#1a1a1a" }}>
        SHIIIIIIT
      </h1>

      <div
        className="aa-body"
        style={{ fontWeight: 600, letterSpacing: "var(--tracking-label)", color: "#1a1a1a" }}
      >
        FRIDAY · 04 SEPTEMBER 2026 · 20:00 CAIRO
      </div>

      <Button variant="primary" size="lg" onClick={enter} style={{ marginTop: "var(--space-2)" }}>
        ENTER
      </Button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          marginTop: "var(--space-6)",
        }}
      >
        <a
          href="https://www.instagram.com/aa.collectives/"
          target="_blank"
          rel="noopener noreferrer"
          className="aa-body"
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", color: "#1a1a1a" }}
        >
          <InstagramIcon size={18} /> @AA.COLLECTIVES
        </a>
        <span className="aa-caption" style={{ color: "#5a4a12" }}>
          CAIRO — NEW YORK
        </span>
      </div>
    </div>
  );
}
