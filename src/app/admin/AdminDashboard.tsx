"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Layers,
  LogOut,
  Mail,
  Loader2,
  RefreshCw,
} from "lucide-react";
import OverviewTab from "./tabs/OverviewTab";
import ProductsTab from "./tabs/ProductsTab";
import CollectionsTab from "./tabs/CollectionsTab";
import BroadcastTab from "./tabs/BroadcastTab";
import type { Product } from "@/lib/products";
import type { CollectionMeta, OrdersResponse } from "./types";

type Tab = "overview" | "products" | "collections" | "broadcast";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "products", label: "Products", icon: Boxes },
  { id: "collections", label: "Collections", icon: Layers },
  { id: "broadcast", label: "Promo email", icon: Mail },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [collections, setCollections] = useState<CollectionMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oRes, pRes, cRes] = await Promise.all([
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/collections", { cache: "no-store" }),
      ]);
      if (!oRes.ok) throw new Error((await oRes.json())?.error ?? "Orders load failed");
      if (!pRes.ok) throw new Error((await pRes.json())?.error ?? "Products load failed");
      if (!cRes.ok)
        throw new Error((await cRes.json())?.error ?? "Collections load failed");
      setOrders((await oRes.json()) as OrdersResponse);
      setProducts(((await pRes.json()) as { products: Product[] }).products);
      setCollections(
        ((await cRes.json()) as { collections: CollectionMeta[] }).collections
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
            Control panel
          </p>
          <h1 className="font-[family-name:var(--font-bebas)] text-5xl tracking-[0.18em] uppercase">
            Admin
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 hover:border-white/40 rounded-md text-xs tracking-[0.2em] uppercase transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 hover:border-[var(--accent)] hover:text-[var(--accent)] rounded-md text-xs tracking-[0.2em] uppercase transition"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-white/10">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-2 px-5 py-3 text-xs tracking-[0.2em] uppercase transition ${
                active ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-white" />
              )}
            </button>
          );
        })}
      </nav>

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
        </>
      )}
    </div>
  );
}
