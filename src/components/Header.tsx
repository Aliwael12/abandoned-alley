"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { regionLabel, useRegion } from "@/lib/region";
import { BagIcon } from "./Socials";
import { NavLink, Badge } from "./ui";

const NAV = [
  { href: "/shop", label: "SHOP", match: ["/shop", "/products"] },
  { href: "/collections", label: "COLLECTIONS", match: ["/collections"] },
  { href: "/contact", label: "CONTACT", match: ["/contact"] },
];

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/home";
  const isCart = pathname === "/cart";
  const region = useRegion((s) => s.region);
  const cartItems = useCart((s) => s.items);
  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--surface-page)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div
        className="aa-header-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          padding: "var(--space-3) var(--space-6)",
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          width: "100%",
          gap: "var(--space-6)",
        }}
      >
        <nav className="aa-header-nav" style={{ display: "flex", gap: "var(--space-8)", justifySelf: "start", flexWrap: "wrap" }}>
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              active={item.match.some((m) => pathname?.startsWith(m))}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Link href="/home" aria-label="Abandoned Alley" className="aa-header-logo" style={{ justifySelf: "center" }}>
          {isHome ? (
            <div data-logo-slot="header" style={{ width: 104, height: 104 }} />
          ) : (
            <Image
              src="/brand/logo-solid-black.png"
              alt="Abandoned Alley"
              width={104}
              height={104}
              style={{ objectFit: "contain", display: "block", filter: "url(#aaRecolorPurpleNav)" }}
              priority
            />
          )}
        </Link>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id="aaRecolorPurpleNav">
            <feFlood floodColor="#5c2ca0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </svg>

        <div
          className="aa-header-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            justifySelf: "end",
          }}
        >
          <Link href="/region">
            <Badge variant="outline">{regionLabel(region)}</Badge>
          </Link>
          {isCart ? (
            <span className="aa-nav-link" style={{ color: "var(--accent-default)" }}>
              <BagIcon size={20} />
              {cartCount > 0 ? cartCount : ""}
            </span>
          ) : (
            <Link href="/cart" className="aa-nav-link">
              <BagIcon size={20} />
              {cartCount > 0 ? cartCount : ""}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
