"use client";

import Link from "next/link";
import { Search, User, ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import dynamic from "next/dynamic";

const Logo3D = dynamic(() => import("./Logo3D"), { ssr: false });
const CartDrawer = dynamic(() => import("./CartDrawer"), { ssr: false });
const SearchModal = dynamic(() => import("./SearchModal"), { ssr: false });

const NAV = [
  { href: "/shop", label: "SHOP" },
  { href: "/contact", label: "Contact" },
  { href: "/collections", label: "COLLECTIONS" },
];

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const cartItems = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const totalCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          {/* Left: mobile menu + desktop nav */}
          <div className="flex items-center gap-6 flex-1">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden text-white"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <nav className="hidden md:flex items-center gap-7 text-sm tracking-[0.2em] uppercase font-[family-name:var(--font-bebas)]">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-white/80 hover:text-white transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="md:hidden text-white"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Center: logo */}
          <Link href="/" className="shrink-0 flex items-center justify-center">
            <Logo3D size={64} rotationSpeed="40deg" />
          </Link>

          {/* Right: actions */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden md:inline-flex text-white/80 hover:text-white transition"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
            <Link
              href="/account"
              className="hidden md:inline-flex text-white/80 hover:text-white transition"
              aria-label="Account"
            >
              <User size={18} />
            </Link>
            <button
              type="button"
              onClick={openCart}
              className="relative text-white/80 hover:text-white transition"
              aria-label="Cart"
            >
              <ShoppingBag size={18} />
              {totalCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[var(--accent)] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg md:hidden flex flex-col p-6">
          <button
            onClick={() => setDrawerOpen(false)}
            className="self-end text-white mb-12"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
          <nav className="flex flex-col gap-7 text-3xl tracking-[0.15em] uppercase font-[family-name:var(--font-bebas)]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className="text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <CartDrawer />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
