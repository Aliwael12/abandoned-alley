"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { takeReturnPath, useRegion } from "@/lib/region";
import { InstagramIcon } from "@/components/Socials";

export default function RegionPage() {
  const router = useRouter();
  const setRegion = useRegion((s) => s.setRegion);

  const select = (region: "eg" | "us") => {
    setRegion(region);
    // Back to whatever the gate interrupted; the landing menu otherwise.
    router.push(takeReturnPath() ?? "/");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "var(--space-16) var(--space-6) var(--space-10)",
          gap: "var(--space-3)",
        }}
      >
        <Image
          src="/brand/logo-solid-black.png"
          alt="Abandoned Alley"
          width={96}
          height={96}
          style={{ objectFit: "contain" }}
        />
        <div className="aa-eyebrow">DON&apos;T DIE WONDERING</div>
        <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)" }}>
          CHOOSE YOUR REGION
        </h1>
      </div>

      <div
        className="aa-region-grid"
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-6)",
          maxWidth: 960,
          margin: "0 auto",
          padding: "0 var(--space-6) var(--space-16)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* United States — cash on delivery, fulfilled manually from the dashboard */}
        <button
          type="button"
          className="aa-region-panel"
          onClick={() => select("us")}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "var(--space-10) var(--space-8)",
            gap: "var(--space-10)",
          }}
        >
          <div>
            <h2 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)" }}>
              NEW YORK
            </h2>
            <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
              USD
            </p>
          </div>
          <div style={{ height: 4, width: 56, background: "var(--graphic-yellow)" }} />
        </button>

        {/* Egypt — the real store */}
        <button
          type="button"
          className="aa-region-panel"
          onClick={() => select("eg")}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "var(--space-10) var(--space-8)",
            gap: "var(--space-10)",
          }}
        >
          <div>
            <h2 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)" }}>
              CAIRO
            </h2>
            <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
              EGP
            </p>
          </div>
          <div style={{ height: 4, width: 56, background: "var(--accent-default)" }} />
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border-default)",
          padding: "var(--space-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/" className="aa-nav-link">
          ← BACK
        </Link>
        <a
          href="https://www.instagram.com/aa.collectives/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
        >
          <InstagramIcon size={20} />
        </a>
      </div>
    </div>
  );
}
