"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const NAV = [
  { href: "/", label: "HOME" },
  { href: "/shop", label: "SHOP" },
  { href: "/collections", label: "COLLECTIONS" },
  { href: "/contact", label: "CONTACT" },
];

const SPRAY = "DON'T DIE WONDERING";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-24 bg-black text-white overflow-hidden">
      <div className="px-6 md:px-10 pt-8 pb-2">
        {/* Top nav row */}
        <nav className="flex flex-wrap items-center justify-between gap-y-3 gap-x-8 font-[family-name:var(--font-bebas)] text-2xl md:text-4xl tracking-[0.04em]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hover:opacity-70 transition"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Meta row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 mb-4 text-[10px] md:text-[11px] tracking-[0.18em] uppercase font-[family-name:var(--font-bebas)] leading-[1.55]">
          <div>
            <p>studio@abandonedalley.example</p>
            <p>Drop 001 — DON&apos;T DIE WONDERING</p>
            <p>Cairo / Online, Worldwide</p>
          </div>
          <div className="md:text-center flex md:justify-center">
            <a
              href="https://instagram.com/abandonedalley.eg"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition"
            >
              INSTAGRAM
            </a>
          </div>
          <div className="md:text-right">
            <p>WEBSITE BY ABND ALLY</p>
            <p>&copy; 2026 — ALL RIGHTS RESERVED</p>
          </div>
        </div>
      </div>

      {/* Wordmark + spray overlay */}
      <div className="relative w-full select-none pb-8 md:pb-12">
        <h2
          className="
            font-[family-name:var(--font-bebas)]
            leading-[0.95]
            text-[#e60a1f]
            text-center
            tracking-[-0.02em]
            font-black
            whitespace-nowrap
            px-2
            py-2
          "
          style={{ fontSize: "clamp(46px, 14.2vw, 230px)" }}
          aria-label="Abandoned Alley"
        >
          ABANDONED ALLEY
        </h2>

        {/* Spray paint overlay */}
        <SprayOverlay text={SPRAY} />
      </div>
    </footer>
  );
}

function SprayOverlay({ text }: { text: string }) {
  // SVG viewBox auto-scales the text to fit the container width, so it can
  // never overflow the ABND ALLY wordmark behind it. The clip-path wipe loops
  // forever, so the text keeps getting "sprayed" left-to-right on repeat.
  const VB_W = 1000;
  const VB_H = 200;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none px-[6%]"
      aria-hidden
    >
      <motion.svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id="spray-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <motion.text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f0c021"
          fontSize={150}
          fontFamily="var(--font-marker), 'Permanent Marker', cursive"
          textLength={VB_W * 0.74}
          lengthAdjust="spacingAndGlyphs"
          transform="rotate(-3.5 500 100)"
          style={{
            filter:
              "drop-shadow(0 0 6px rgba(240,192,33,0.55)) drop-shadow(0 0 18px rgba(240,192,33,0.3))",
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
