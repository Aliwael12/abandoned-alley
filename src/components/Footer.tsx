"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { InstagramIcon } from "./Socials";

const SPRAY = "DON'T DIE WONDERING";

export default function Footer() {
  return (
    <footer
      style={{
        position: "relative",
        zIndex: 10,
        marginTop: "var(--space-24)",
        background: "var(--text-primary)",
        overflow: "hidden",
      }}
    >
      <div
        className="aa-footer-grid"
        style={{
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr",
          gap: "var(--space-12)",
          padding: "var(--space-16) var(--space-6) var(--space-10)",
        }}
      >
        <div>
          <Image
            src="/brand/logo-solid-black.png"
            alt="Abandoned Alley"
            width={32}
            height={32}
            style={{ objectFit: "contain", marginBottom: "var(--space-4)", filter: "invert(1)" }}
          />
          <p className="aa-body" style={{ color: "var(--text-on-accent)", opacity: 0.7, maxWidth: 320 }}>
            Egyptian streetwear, made in Cairo, worn everywhere. Don&apos;t die wondering.
          </p>
        </div>

        <div>
          <div className="aa-eyebrow" style={{ color: "var(--graphic-yellow)", marginBottom: "var(--space-4)" }}>
            SHOP
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Link href="/" className="aa-body" style={{ color: "var(--text-on-accent)" }}>Home</Link>
            <Link href="/shop" className="aa-body" style={{ color: "var(--text-on-accent)" }}>All products</Link>
            <Link href="/collections" className="aa-body" style={{ color: "var(--text-on-accent)" }}>Collections</Link>
            <Link href="/cart" className="aa-body" style={{ color: "var(--text-on-accent)" }}>Bag</Link>
          </div>
        </div>

        <div>
          <div className="aa-eyebrow" style={{ color: "var(--graphic-yellow)", marginBottom: "var(--space-4)" }}>
            CONTACT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <a href="mailto:hello@abandonedalley.com" className="aa-body" style={{ color: "var(--text-on-accent)" }}>
              hello@abandonedalley.com
            </a>
            <a
              href="https://www.instagram.com/aa.collectives/"
              target="_blank"
              rel="noopener noreferrer"
              className="aa-body"
              style={{
                color: "var(--text-on-accent)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <InstagramIcon size={16} /> @aa.collectives
            </a>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          padding: "0 var(--space-6)",
          paddingTop: "var(--space-6)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <span className="aa-caption" style={{ color: "var(--text-on-accent)", opacity: 0.6 }}>
          © 2026 ABANDONED ALLEY
        </span>
        <span className="aa-caption" style={{ color: "var(--text-on-accent)", opacity: 0.6 }}>
          CAIRO — NEW YORK
        </span>
      </div>

      {/* Wordmark + spray overlay */}
      <div
        style={{
          position: "relative",
          width: "100%",
          userSelect: "none",
          marginTop: "var(--space-12)",
          paddingBottom: "var(--space-10)",
        }}
      >
        <h2
          style={{
            position: "relative",
            fontFamily: "var(--font-display)",
            lineHeight: 0.95,
            color: "var(--accent-default)",
            textAlign: "center",
            letterSpacing: "-0.02em",
            fontWeight: 400,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            padding: "var(--space-2)",
            fontSize: "clamp(46px, 14.2vw, 230px)",
          }}
          aria-label="Abandoned Alley"
        >
          ABANDONED ALLEY
        </h2>

        <SprayOverlay text={SPRAY} />
      </div>
    </footer>
  );
}

function SprayOverlay({ text }: { text: string }) {
  // SVG viewBox auto-scales the text to fit the container width, so it can
  // never overflow the wordmark behind it. The clip-path wipe loops forever,
  // so the text keeps getting "sprayed" left-to-right on repeat.
  const VB_W = 1000;
  const VB_H = 200;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        padding: "0 6%",
      }}
    >
      <motion.svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", overflow: "visible" }}
      >
        <motion.text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--graphic-yellow)"
          fontSize={150}
          fontFamily="var(--font-marker), 'Permanent Marker', cursive"
          textLength={VB_W * 0.74}
          lengthAdjust="spacingAndGlyphs"
          transform="rotate(-3.5 500 100)"
          style={{
            filter:
              "drop-shadow(0 0 6px rgba(255,212,0,0.55)) drop-shadow(0 0 18px rgba(255,212,0,0.3))",
          }}
          animate={{
            clipPath: [
              "inset(0% 100% 0% 0%)",
              "inset(-10% -2% -10% -2%)",
              "inset(-10% -2% -10% -2%)",
              "inset(0% 100% 0% 0%)",
            ],
          }}
          transition={{
            duration: 5.2,
            times: [0, 0.55, 0.85, 1],
            ease: [0.22, 1, 0.36, 1],
            repeat: Infinity,
            repeatDelay: 0.6,
          }}
        >
          {text}
        </motion.text>
      </motion.svg>
    </div>
  );
}
