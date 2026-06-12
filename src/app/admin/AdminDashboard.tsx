"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  Inbox,
  Layers,
  LineChart,
  LogOut,
  Mail,
  Loader2,
  RefreshCw,
  Ruler,
  Settings,
  ShoppingBag,
} from "lucide-react";
import OverviewTab from "./tabs/OverviewTab";
import OrdersTab from "./tabs/OrdersTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import ProductsTab from "./tabs/ProductsTab";
import CollectionsTab from "./tabs/CollectionsTab";
import BroadcastTab from "./tabs/BroadcastTab";
import ContactTab from "./tabs/ContactTab";
import SettingsTab from "./tabs/SettingsTab";
import SizeChartsTab from "./tabs/SizeChartsTab";
import type { Product } from "@/lib/products";
import type { CollectionMeta, OrdersResponse } from "./types";

type Tab =
  | "overview"
  | "orders"
  | "analytics"
  | "products"
  | "collections"
  | "broadcast"
  | "contact"
  | "sizeCharts"
  | "settings";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "analytics", label: "Analytics", icon: LineChart },
  { id: "products", label: "Products", icon: Boxes },
  { id: "collections", label: "Collections", icon: Layers },
  { id: "broadcast", label: "Promo email", icon: Mail },
  { id: "contact", label: "Contact", icon: Inbox },
  { id: "sizeCharts", label: "Size charts", icon: Ruler },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Narrow a raw `?tab=` value to a known tab, defaulting to overview. */
function tabFromParam(raw: string | null): Tab {
  return TABS.some((t) => t.id === raw) ? (raw as Tab) : "overview";
}

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The active tab lives in the URL (?tab=orders) so it survives navigating
  // into an order and back, refreshes, and bookmarks. Initialized from the
  // param; selecting a tab updates the URL in place.
  const [tab, setTabState] = useState<Tab>(() =>
    tabFromParam(searchParams.get("tab"))
  );

  const selectTab = useCallback(
    (next: Tab) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
    },
    [router, searchParams]
  );
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [collections, setCollections] = useState<CollectionMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [oRes, pRes, cRes] = await Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }),
      fetch("/api/admin/products", { cache: "no-store" }),
      fetch("/api/admin/collections", { cache: "no-store" }),
    ]);
    if (!oRes.ok) throw new Error((await oRes.json())?.error ?? "Orders load failed");
    if (!pRes.ok) throw new Error((await pRes.json())?.error ?? "Products load failed");
    if (!cRes.ok)
      throw new Error((await cRes.json())?.error ?? "Collections load failed");
    return {
      orders: (await oRes.json()) as OrdersResponse,
      products: ((await pRes.json()) as { products: Product[] }).products,
      collections: ((await cRes.json()) as { collections: CollectionMeta[] })
        .collections,
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadAll();
      setOrders(data.orders);
      setProducts(data.products);
      setCollections(data.collections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((data) => {
        if (cancelled) return;
        setOrders(data.orders);
        setProducts(data.products);
        setCollections(data.collections);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  // Keep the active tab in sync when the URL changes without going through
  // selectTab — e.g. browser back/forward, or landing on /admin?tab=orders.
  const paramTab = tabFromParam(searchParams.get("tab"));
  useEffect(() => {
    setTabState(paramTab);
  }, [paramTab]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex flex-row items-center justify-between gap-3 md:items-end">
        <div>
          <p className="text-[10px] md:text-[11px] tracking-[0.4em] uppercase text-white/50">
            Control panel
          </p>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-5xl tracking-[0.18em] uppercase">
            Admin
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh"
            className="inline-flex items-center gap-2 px-3 md:px-4 py-2 border border-white/15 hover:border-white/40 rounded-md text-xs tracking-[0.2em] uppercase transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden md:inline">Refresh</span>
          </button>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="inline-flex items-center gap-2 px-3 md:px-4 py-2 border border-white/15 hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-md text-xs tracking-[0.2em] uppercase transition"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </header>

      <TabNav tab={tab} onSelect={selectTab} />

      {error && (
        <div className="glass rounded-md p-4 text-sm text-[var(--accent)]">
          {error}
        </div>
      )}

      {loading && !orders && !products ? (
        <div className="flex items-center justify-center py-24 text-white/40">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          {tab === "overview" && <OverviewTab data={orders} />}
          {tab === "orders" && (
            <OrdersTab onChanged={refresh} onError={(m) => setError(m)} />
          )}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "products" && (
            <ProductsTab
              products={products ?? []}
              onChanged={refresh}
              onError={(m) => setError(m)}
            />
          )}
          {tab === "collections" && (
            <CollectionsTab
              collections={collections ?? []}
              products={products ?? []}
              onChanged={refresh}
              onError={(m) => setError(m)}
            />
          )}
          {tab === "broadcast" && <BroadcastTab onError={(m) => setError(m)} />}
          {tab === "contact" && <ContactTab onError={(m) => setError(m)} />}
          {tab === "sizeCharts" && (
            <SizeChartsTab
              products={products ?? []}
              onChanged={refresh}
              onError={(m) => setError(m)}
            />
          )}
          {tab === "settings" && <SettingsTab onError={(m) => setError(m)} />}
        </>
      )}
    </div>
  );
}

/**
 * Responsive tab navigation.
 * - md+: the original underline tab bar.
 * - below md: a dropdown so the nine tabs never overflow a phone screen —
 *   a single button shows the active tab and opens a tap-list of all tabs.
 */
function TabNav({
  tab,
  onSelect,
}: {
  tab: Tab;
  onSelect: (t: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const ActiveIcon = active.icon;

  return (
    <>
      {/* Mobile: dropdown menu */}
      <div ref={wrapRef} className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 border border-white/15 rounded-md text-xs tracking-[0.2em] uppercase text-white transition hover:border-white/40"
        >
          <span className="inline-flex items-center gap-2">
            <ActiveIcon size={14} />
            {active.label}
          </span>
          <ChevronDown
            size={16}
            className={`text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 right-0 z-30 mt-2 rounded-md border border-white/10 bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {TABS.map((t) => {
              const isActive = t.id === tab;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(t.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-xs tracking-[0.2em] uppercase transition ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  <span className="flex-1">{t.label}</span>
                  {isActive && <Check size={14} className="text-white/70" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop: underline tab bar */}
      <nav className="hidden md:flex gap-1 border-b border-white/10">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`relative inline-flex items-center gap-2 px-5 py-3 text-xs tracking-[0.2em] uppercase transition ${
                isActive ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-white" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
