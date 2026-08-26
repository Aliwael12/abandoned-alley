"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRegion } from "@/lib/region";
import { InstagramIcon } from "@/components/Socials";

export default function RegionPage() {
  const router = useRouter();
  const setRegion = useRegion((s) => s.setRegion);
  const [usNotice, setUsNotice] = useState(false);

  const selectEg = () => {
    setRegion("eg");
    router.push("/home");
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
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-6)",
          maxWidth: 960,
          margin: "0 auto",
          padding: "0 var(--space-6) var(--space-16)",
          width: "100%",
        }}
      >
        {/* United States — not a real store yet */}
        <button
          type="button"
          className="aa-region-panel"
          onClick={() => setUsNotice(true)}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "var(--space-10) var(--space-8)",
            gap: "var(--space-10)",
          }}
        >
          <div>
            <div className="aa-caption">01 — UNITED STATES</div>
            <h2 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-4)" }}>
              NEW YORK
            </h2>
            <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
              USD · US sizing
            </p>
            {usNotice && (
              <p className="aa-caption" style={{ color: "var(--accent-default)", marginTop: "var(--space-4)" }}>
                NOT AVAILABLE YET — WE&apos;LL ANNOUNCE THE US LAUNCH ON INSTAGRAM
              </p>
            )}
          </div>
          <div style={{ height: 4, width: 56, background: "var(--graphic-yellow)" }} />
        </button>

        {/* Egypt — the real store */}
        <button
          type="button"
          className="aa-region-panel"
          onClick={selectEg}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "var(--space-10) var(--space-8)",
            gap: "var(--space-10)",
          }}
        >
          <div>
            <div className="aa-caption">02 — EGYPT</div>
            <h2 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-4)" }}>
              CAIRO
            </h2>
            <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
              EGP · EU sizing
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
