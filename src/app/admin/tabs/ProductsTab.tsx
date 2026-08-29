"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { Media, Product, StockMap } from "@/lib/products";
import {
  REGION_CURRENCY,
  REGION_LABEL,
  priceForRegion,
  type Region,
} from "@/lib/pricing";
import {
  LOW_STOCK_THRESHOLD,
  productSizes,
  stockBadge,
  stockForSize,
} from "@/lib/inventory";

type Props = {
  products: Product[];
  onChanged: () => void | Promise<void>;
  onError: (msg: string) => void;
};

type EditState = Partial<
  Pick<Product, "title" | "description" | "price" | "sizeChartId">
> & {
  media?: Media[];
  clearSizeChart?: boolean;
  stock?: StockMap;
  /** US price in USD; null clears it and removes the product from the US store. */
  priceUsd?: number | null;
};

type SizeChartOption = { handle: string; name: string };

const fmtPrice = (n: number, region: Region) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: REGION_CURRENCY[region],
  });

function MediaEditor({
  media,
  onChange,
}: {
  media: Media[];
  onChange: (next: Media[]) => void;
}) {
  const [url, setUrl] = useState("");

  function add() {
    const src = url.trim();
    if (!src) return;
    onChange([...media, { type: "image", src }]);
    setUrl("");
  }

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= media.length) return;
    const next = media.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function remove(i: number) {
    if (media.length === 1 && !confirm("Remove the only image for this product?")) return;
    onChange(media.filter((_, idx) => idx !== i));
  }

  function setMain(i: number) {
    if (i === 0) return;
    const next = media.slice();
    const [picked] = next.splice(i, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
        Images ({media.length})
      </div>

      {media.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-2">
          No images yet — add one below. The first image is the main card image.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {media.map((m, i) => {
            const isMain = i === 0;
            return (
              <li
                key={`${i}-${m.src}`}
                className="flex items-center gap-3 bg-[var(--surface-card-alt)] border border-[var(--border-subtle)]  p-2"
              >
                <div className="relative w-12 h-12 bg-[var(--surface-card-alt)] rounded overflow-hidden shrink-0 grid place-items-center">
                  {m.type === "image" ? (
                    <Image
                      src={m.src}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-[9px] tracking-[0.2em] uppercase text-[var(--text-muted)]">
                      Video
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isMain && (
                      <span className="px-1.5 py-0.5 text-[9px] tracking-[0.2em] uppercase border border-[var(--border-strong)] rounded text-[var(--text-primary)]">
                        Main
                      </span>
                    )}
                    <code className="text-[11px] text-[var(--text-muted)] truncate font-mono">
                      {m.src}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="w-8 h-8 grid place-items-center border border-[var(--border-default)] rounded hover:border-[var(--border-strong)] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === media.length - 1}
                    aria-label="Move down"
                    className="w-8 h-8 grid place-items-center border border-[var(--border-default)] rounded hover:border-[var(--border-strong)] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMain(i)}
                    disabled={isMain}
                    aria-label="Set as main"
                    title="Set as main"
                    className="w-8 h-8 grid place-items-center border border-[var(--border-default)] rounded hover:border-[var(--border-strong)] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Star size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove"
                    className="w-8 h-8 grid place-items-center border border-[var(--border-default)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          placeholder="Image URL (https://… or /media/…)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-10 px-3 text-sm outline-none focus:border-[var(--border-strong)] transition flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={!url.trim()}
          className="px-4 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}

function StockEditor({
  sizes,
  stock,
  onChange,
}: {
  sizes: string[];
  stock: StockMap;
  onChange: (next: StockMap) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
        Stock per size
      </div>
      {sizes.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-1">
          This product has no sizes to stock.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {sizes.map((size) => {
            const qty = stockForSize(stock, size);
            const badge = stockBadge(qty);
            const ring =
              badge === "soldout"
                ? "border-[var(--accent)]/60"
                : badge === "low"
                  ? "border-[var(--warning-default)]/60"
                  : "border-[var(--border-default)]";
            return (
              <label
                key={size}
                className={`flex flex-col gap-1  border ${ring} bg-[var(--surface-card-alt)] px-3 py-2`}
              >
                <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)]">
                  {size}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={qty}
                  onChange={(e) => {
                    const n = Math.max(0, Math.floor(Number(e.target.value)));
                    onChange({
                      ...stock,
                      [size]: Number.isFinite(n) ? n : 0,
                    });
                  }}
                  className="w-20 bg-transparent border border-[var(--border-default)] rounded h-9 px-2 text-sm outline-none focus:border-[var(--border-strong)] transition"
                />
                {badge !== "ok" && (
                  <span
                    className={`text-[9px] tracking-[0.2em] uppercase ${
                      badge === "soldout"
                        ? "text-[var(--accent)]"
                        : "text-[var(--warning-default)]"
                    }`}
                  >
                    {badge === "soldout" ? "Sold out" : "Low"}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-[var(--text-muted)]">
        Low-stock warning at or below {LOW_STOCK_THRESHOLD} units. A size at 0 is
        sold out on the storefront.
      </p>
    </div>
  );
}

function StockSummary({ product }: { product: Product }) {
  const sizes = productSizes(product);
  if (sizes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] mr-1">
        Stock
      </span>
      {sizes.map((size) => {
        const qty = stockForSize(product.stock, size);
        const badge = stockBadge(qty);
        const cls =
          badge === "soldout"
            ? "border-[var(--accent)]/50 text-[var(--accent)]"
            : badge === "low"
              ? "border-[var(--warning-default)]/50 text-[var(--warning-default)]"
              : "border-[var(--border-default)] text-[var(--text-muted)]";
        return (
          <span
            key={size}
            className={`px-1.5 py-0.5 text-[10px] rounded border ${cls}`}
            title={
              badge === "soldout"
                ? `${size}: sold out`
                : badge === "low"
                  ? `${size}: low (${qty})`
                  : `${size}: ${qty} in stock`
            }
          >
            {size} {qty}
          </span>
        );
      })}
    </div>
  );
}

export default function ProductsTab({ products, onChanged, onError }: Props) {
  // Which region's pricing this tab is editing/showing. The two prices are
  // independent numbers, not a conversion, so only one is in view at a time.
  const [priceRegion, setPriceRegion] = useState<Region>("eg");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditState>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    description: "",
    price: "",
    collection: "general",
    media: [] as Media[],
  });
  const [sizeCharts, setSizeCharts] = useState<SizeChartOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/size-charts", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as {
          charts: { handle: string; name: string }[];
        };
        if (!cancelled) {
          setSizeCharts(data.charts.map((c) => ({ handle: c.handle, name: c.name })));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function startEdit(p: Product) {
    setEditing(p.handle);
    const stock: StockMap = {};
    for (const size of productSizes(p)) stock[size] = stockForSize(p.stock, size);
    setDraft({
      title: p.title,
      description: p.description,
      price: p.price,
      priceUsd: p.priceUsd,
      media: p.media,
      sizeChartId: p.sizeChartId ?? "",
      clearSizeChart: false,
      stock,
    });
  }

  async function saveEdit(handle: string) {
    setBusy(handle);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Update failed");
      setEditing(null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleDisabled(p: Product) {
    setBusy(p.handle);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(p.handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !p.disabled }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Update failed");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setBusy(p.handle);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(p.handle)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Delete failed");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Swap sortOrder with the adjacent product in the currently-displayed
   * (already sortOrder-sorted) list. Products without a sortOrder yet get one
   * assigned from their current position so the swap has real values to work
   * with.
   */
  async function move(p: Product, delta: number) {
    const idx = products.findIndex((x) => x.handle === p.handle);
    const j = idx + delta;
    if (idx === -1 || j < 0 || j >= products.length) return;
    const other = products[j];
    const pOrder = p.sortOrder ?? (idx + 1) * 10;
    const otherOrder = other.sortOrder ?? (j + 1) * 10;
    setBusy(p.handle);
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/admin/products/${encodeURIComponent(p.handle)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: otherOrder }),
        }),
        fetch(`/api/admin/products/${encodeURIComponent(other.handle)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: pOrder }),
        }),
      ]);
      if (!resA.ok) throw new Error((await resA.json())?.error ?? "Reorder failed");
      if (!resB.ok) throw new Error((await resB.json())?.error ?? "Reorder failed");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reorder failed");
    } finally {
      setBusy(null);
    }
  }

  async function createProduct() {
    setBusy("__new__");
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createDraft.title,
          description: createDraft.description,
          collection: createDraft.collection,
          media: createDraft.media,
          price: Number(createDraft.price),
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Create failed");
      setCreating(false);
      setCreateDraft({
        title: "",
        description: "",
        price: "",
        collection: "general",
        media: [],
      });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  const inputCls =
    "bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-10 px-3 text-sm outline-none focus:border-[var(--border-strong)] transition w-full";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Catalog ({products.length})
        </h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-[var(--border-default)]">
            {(["eg", "us"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setPriceRegion(r)}
                style={
                  priceRegion === r
                    ? { background: "var(--accent-default)", color: "var(--text-on-accent)" }
                    : undefined
                }
                className="px-3 py-2 text-[11px] tracking-[0.2em] uppercase transition"
              >
                {REGION_LABEL[r]}
              </button>
            ))}
          </div>
        <button
          onClick={() => setCreating((v) => !v)}
          style={{ color: creating ? undefined : "var(--text-on-accent)" }}
          className={
            creating
              ? "inline-flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase transition"
              : "inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-default)]  text-xs tracking-[0.2em] uppercase transition"
          }
        >
          {creating ? <X size={14} /> : <Plus size={14} />}
          {creating ? "Cancel" : "New product"}
        </button>
        </div>
      </div>

      {creating && (
        <div className="glass  p-6 flex flex-col gap-4">
          <input
            placeholder="Title"
            value={createDraft.title}
            onChange={(e) => setCreateDraft({ ...createDraft, title: e.target.value })}
            className={inputCls}
          />
          <textarea
            placeholder="Description"
            rows={3}
            value={createDraft.description}
            onChange={(e) => setCreateDraft({ ...createDraft, description: e.target.value })}
            className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  p-3 text-sm outline-none focus:border-[var(--border-strong)] transition resize-none"
          />
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="number"
              step="0.01"
              placeholder="Price (EGP)"
              value={createDraft.price}
              onChange={(e) => setCreateDraft({ ...createDraft, price: e.target.value })}
              className={inputCls}
            />
            <input
              placeholder="Collection handle"
              value={createDraft.collection}
              onChange={(e) => setCreateDraft({ ...createDraft, collection: e.target.value })}
              className={inputCls}
            />
          </div>
          <MediaEditor
            media={createDraft.media}
            onChange={(media) => setCreateDraft({ ...createDraft, media })}
          />
          <button
            onClick={createProduct}
            disabled={
              busy === "__new__" ||
              !createDraft.title ||
              !createDraft.price ||
              createDraft.media.length === 0
            }
            style={{ color: "var(--text-on-accent)" }}
            className="self-start bg-[var(--accent-default)] px-5 py-2.5  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy === "__new__" && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {products.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6">
            No products yet. Use the <em>New product</em> form above to add one.
          </p>
        ) : (
          products.map((p, idx) => {
            const isEditing = editing === p.handle;
            const head = p.media[0];
            const img =
              head && head.type === "image"
                ? head
                : p.media.find((m) => m.type === "image");
            return (
              <li
                key={p.handle}
                className={`glass  p-5 flex flex-col md:flex-row gap-5 ${
                  p.disabled ? "opacity-60" : ""
                }`}
              >
                <div className="relative w-full md:w-32 h-40 md:h-32 bg-[var(--surface-card-alt)]  overflow-hidden shrink-0">
                  {img && img.type === "image" && (
                    <Image
                      src={img.src}
                      alt={p.title}
                      fill
                      sizes="128px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-3 min-w-0">
                  {isEditing ? (
                    <>
                      <input
                        value={draft.title ?? ""}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className={inputCls}
                      />
                      <textarea
                        rows={3}
                        value={draft.description ?? ""}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  p-3 text-sm outline-none focus:border-[var(--border-strong)] transition resize-none"
                      />
                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
                          {priceRegion === "eg" ? "Price (EGP)" : "Price (USD)"}
                        </span>
                        {priceRegion === "eg" ? (
                          <input
                            type="number"
                            step="0.01"
                            value={draft.price ?? 0}
                            onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                            className={inputCls}
                          />
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Not sold in the US"
                            value={draft.priceUsd ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                priceUsd: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className={inputCls}
                          />
                        )}
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {priceRegion === "eg"
                            ? "Shown to shoppers in the Egypt store."
                            : "Shown in the US store. Leave empty to hide this product there."}
                        </span>
                      </label>
                      <MediaEditor
                        media={draft.media ?? []}
                        onChange={(media) => setDraft({ ...draft, media })}
                      />
                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
                          Size chart
                        </span>
                        <select
                          value={draft.clearSizeChart ? "" : draft.sizeChartId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDraft({
                              ...draft,
                              sizeChartId: v,
                              clearSizeChart: !v,
                            });
                          }}
                          className={inputCls}
                        >
                          <option value="">None</option>
                          {sizeCharts.map((c) => (
                            <option key={c.handle} value={c.handle}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <StockEditor
                        sizes={productSizes(p)}
                        stock={draft.stock ?? {}}
                        onChange={(stock) => setDraft({ ...draft, stock })}
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.1em]">
                          {p.title}
                        </h3>
                        {p.disabled && (
                          <span className="px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase border border-[var(--border-default)] rounded text-[var(--text-muted)]">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2">{p.description}</p>
                      <p className="text-sm">
                        {priceForRegion(p, priceRegion) === null ? (
                          <span className="text-[var(--text-muted)]">
                            No {REGION_CURRENCY[priceRegion]} price
                          </span>
                        ) : (
                          fmtPrice(priceForRegion(p, priceRegion)!, priceRegion)
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">/{p.handle}</p>
                      <StockSummary product={p} />
                      {p.sizeChartId && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Size chart:{" "}
                          {sizeCharts.find((c) => c.handle === p.sizeChartId)?.name ??
                            p.sizeChartId}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap md:flex-col md:flex-nowrap items-stretch gap-2 md:shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(p.handle)}
                        disabled={busy === p.handle}
                        style={{ color: "var(--text-on-accent)" }}
                        className="px-4 py-2 bg-[var(--accent-default)]  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {busy === p.handle && <Loader2 size={12} className="animate-spin" />}
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-4 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          onClick={() => move(p, -1)}
                          disabled={busy === p.handle || idx === 0}
                          aria-label="Move up"
                          title="Move up"
                          className="flex-1 px-3 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => move(p, 1)}
                          disabled={busy === p.handle || idx === products.length - 1}
                          aria-label="Move down"
                          title="Move down"
                          className="flex-1 px-3 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => startEdit(p)}
                        className="px-3 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => toggleDisabled(p)}
                        disabled={busy === p.handle}
                        className="px-3 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {p.disabled ? <Eye size={12} /> : <EyeOff size={12} />}
                        {p.disabled ? "Show" : "Hide"}
                      </button>
                      <button
                        onClick={() => remove(p)}
                        disabled={busy === p.handle}
                        className="px-3 py-2 border border-[var(--border-default)] hover:border-[var(--accent)] hover:text-[var(--accent)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
