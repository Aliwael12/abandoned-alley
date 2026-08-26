"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import type { CollectionMeta } from "@/lib/collections-server";
import { useRequireRegion } from "@/lib/region";
import { Button, Input } from "./ui";
import ProductCard from "./ProductCard";

const CATEGORY_TINTS: Record<string, string> = {
  hoodies: "var(--tint-hoodies)",
  tees: "var(--tint-tees)",
  bottoms: "var(--tint-bottoms)",
  outerwear: "var(--tint-outerwear)",
  accessories: "var(--tint-accessories)",
};

const SOCIAL_PHOTOS = [
  "/brand/products/tee-cap-pin-brown.png",
  "/brand/products/tee-butter-yellow-lavender.png",
  "/brand/products/shorts-lilac.png",
  "/brand/products/cap-pink-plaid.png",
];

export default function HomeContent({
  products,
  collections,
}: {
  products: Product[];
  collections: CollectionMeta[];
}) {
  const { ready } = useRequireRegion();
  const heroSlotRef = useRef<HTMLDivElement>(null);
  const flyingLogoRef = useRef<HTMLImageElement>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!ready) return;

    function place() {
      const hero = heroSlotRef.current;
      const head = document.querySelector<HTMLElement>('[data-logo-slot="header"]');
      const img = flyingLogoRef.current;
      if (!hero || !head || !img) return;
      const hr = hero.getBoundingClientRect();
      const tr = head.getBoundingClientRect();
      const y = window.scrollY || 0;
      const travel = Math.max(1, hr.top + y - tr.top);
      const p = Math.min(1, Math.max(0, y / travel));
      const t = p * p * (3 - 2 * p);
      const lerp = (a: number, b: number) => a + (b - a) * t;
      img.style.width = `${lerp(hr.width, tr.width)}px`;
      img.style.height = `${lerp(hr.height, tr.height)}px`;
      img.style.transform = `translate(${lerp(hr.left, tr.left)}px, ${lerp(hr.top, tr.top)}px)`;
    }

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        place();
        ticking = false;
      });
    }

    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ready]);

  if (!ready) return null;

  const newArrivals = products.slice(0, 3);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || subscribing) return;
    setSubscribing(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSubscribed(true);
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div>
      {/* SVG recolor filters for the logo color-cycle */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id="aaRecolorRed">
          <feFlood floodColor="#e72715" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="aaRecolorYellow">
          <feFlood floodColor="#ffd400" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="aaRecolorPurple">
          <feFlood floodColor="#5c2ca0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </svg>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={flyingLogoRef}
        src="/brand/logo-solid-black.png"
        alt=""
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "min(52vw, 360px)",
          height: "min(52vw, 360px)",
          objectFit: "contain",
          pointerEvents: "none",
          zIndex: 30,
          willChange: "transform, width, height",
          animation: "aaLogoColorCycle 2.6s steps(1,end) forwards",
        }}
      />

      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "var(--space-20) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "var(--space-6)",
        }}
      >
        <div
          ref={heroSlotRef}
          data-logo-slot="hero"
          style={{ position: "relative", zIndex: 1, width: "min(52vw, 360px)", height: "min(52vw, 360px)" }}
        />
        <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/shop"><Button variant="ghost" size="lg">SHOP ALL</Button></Link>
          <Link href="/shop?category=HOODIES"><Button variant="ghost" size="lg">SHOP DROP 004</Button></Link>
        </div>
      </section>

      {/* Collections */}
      <section
        id="collections"
        style={{ scrollMarginTop: 140, padding: "var(--space-16) var(--space-6)" }}
      >
        <div style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <div className="aa-eyebrow">SHOP BY CATEGORY</div>
          <h2 className="aa-display-h2" style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-8)" }}>
            COLLECTIONS
          </h2>
          <div className="aa-grid">
            {collections.map((c) => {
              const tint = CATEGORY_TINTS[c.title.toLowerCase()] ?? "var(--surface-card-alt)";
              return (
                <Link
                  key={c.handle}
                  href={`/collections/${c.handle}`}
                  style={{ gridColumn: "span 4" }}
                >
                  <div
                    className="aa-collection-tile"
                    style={{
                      aspectRatio: "4 / 5",
                      border: "1px solid var(--border-default)",
                      background: tint,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {c.image && (
                      <Image src={c.image} alt={c.title} fill style={{ objectFit: "cover" }} unoptimized />
                    )}
                  </div>
                  <h3 className="aa-display-h3" style={{ marginTop: "var(--space-3)" }}>
                    {c.title}
                  </h3>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <section style={{ padding: "var(--space-16) var(--space-6)" }}>
          <div style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "var(--space-8)",
              }}
            >
              <h2 className="aa-display-h2">NEW ARRIVALS</h2>
              <Link href="/shop" style={{ color: "var(--accent-default)" }} className="aa-nav-link">
                VIEW ALL →
              </Link>
            </div>
            <div className="aa-grid">
              {newArrivals.map((p) => (
                <div key={p.handle} style={{ gridColumn: "span 4" }}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Editorial banner */}
      <section style={{ background: "var(--graphic-yellow)", padding: "var(--space-16) var(--space-6)" }}>
        <div
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "var(--space-8)",
            alignItems: "center",
          }}
        >
          <Image
            src="/brand/logo-solid-black.png"
            alt="Abandoned Alley"
            width={140}
            height={140}
            style={{ objectFit: "contain" }}
          />
          <div>
            <div className="aa-eyebrow" style={{ color: "#5a4a12" }}>THE ALLEY</div>
            <h2 className="aa-display-h2" style={{ color: "#1a1a1a", marginTop: "var(--space-2)" }}>
              MADE IN CAIRO. WORN EVERYWHERE.
            </h2>
            <p className="aa-body" style={{ color: "#3a3524", marginTop: "var(--space-3)", maxWidth: 560 }}>
              Every drop runs once. Cut, printed, and finished in Cairo, then shipped to whoever&apos;s
              still awake enough to want it.
            </p>
          </div>
        </div>
      </section>

      {/* Social strip */}
      <section style={{ padding: "var(--space-16) var(--space-6)" }}>
        <div style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <h2 className="aa-display-h2" style={{ marginBottom: "var(--space-6)" }}>
            FOLLOW @AA.COLLECTIVES
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--space-3)" }}>
            {SOCIAL_PHOTOS.map((src) => (
              <a
                key={src}
                href="https://www.instagram.com/aa.collectives/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ position: "relative", aspectRatio: "1 / 1", display: "block" }}
              >
                <Image src={src} alt="" fill style={{ objectFit: "cover" }} unoptimized />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ background: "var(--surface-raised)", padding: "var(--space-16) var(--space-6)" }}>
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <h2 className="aa-display-h2">STAY IN THE LOOP</h2>
          <form
            onSubmit={subscribe}
            style={{ display: "flex", gap: "var(--space-3)", maxWidth: 420, width: "100%" }}
          >
            <Input
              type="email"
              required
              placeholder="EMAIL ADDRESS"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={subscribed}
            />
            <Button type="submit" variant="primary" size="md" disabled={subscribed || subscribing}>
              {subscribed ? "SUBSCRIBED ✓" : "SUBSCRIBE"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
