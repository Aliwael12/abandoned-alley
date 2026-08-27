"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { BagIcon } from "./Socials";
import { NavLink } from "./ui";

const NAV = [
  { href: "/shop", label: "SHOP", match: ["/shop", "/products"] },
  { href: "/collections", label: "COLLECTIONS", match: ["/collections"] },
  { href: "/contact", label: "CONTACT", match: ["/contact"] },
];

export default function Header() {
  const pathname = usePathname();
  const isCart = pathname === "/cart";
  const cartItems = useCart((s) => s.items);
  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);

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
        <nav className="aa-header-nav" style={{ display: "flex", gap: "var(--space-8)", justifySelf: "start" }}>
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

        <button
          type="button"
          className="aa-header-mobile-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          style={{
            display: "none",
            justifySelf: "start",
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link href="/home" aria-label="Abandoned Alley" className="aa-header-logo" style={{ justifySelf: "center" }}>
          <Image
            src="/brand/logo-solid-black.png"
            alt="Abandoned Alley"
            width={104}
            height={104}
            style={{ objectFit: "contain", display: "block", filter: "url(#aaRecolorPurpleNav)" }}
            priority
          />
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

      {menuOpen && (
        <nav
          className="aa-header-mobile-menu"
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid var(--border-default)",
            background: "var(--surface-page)",
          }}
        >
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              active={item.match.some((m) => pathname?.startsWith(m))}
              onClick={() => setMenuOpen(false)}
              style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border-subtle)" }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
