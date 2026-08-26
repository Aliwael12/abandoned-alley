"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Product } from "@/lib/products";
import type { CollectionMeta } from "../types";

type Props = {
  collections: CollectionMeta[];
  products: Product[];
  onChanged: () => void | Promise<void>;
  onError: (msg: string) => void;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const inputCls =
  "bg-[var(--surface-card-alt)] border border-[var(--border-default)]  h-10 px-3 text-sm outline-none focus:border-[var(--border-strong)] transition w-full";

export default function CollectionsTab({
  collections,
  products,
  onChanged,
  onError,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    image: "",
    description: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CollectionMeta>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  async function createCollection() {
    setBusy("__new__");
    try {
      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createDraft),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Create failed");
      setCreating(false);
      setCreateDraft({ title: "", image: "", description: "" });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(c: CollectionMeta) {
    setEditing(c.handle);
    setEditDraft({
      title: c.title,
      image: c.image,
      description: c.description ?? "",
    });
  }

  async function saveEdit(handle: string) {
    setBusy(handle);
    try {
      const res = await fetch(`/api/admin/collections/${handle}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
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

  async function removeCollection(c: CollectionMeta) {
    const cnt = c.count ?? 0;
    const warn =
      cnt > 0
        ? `This collection still has ${cnt} product${cnt === 1 ? "" : "s"}. They will lose their collection assignment. Delete anyway?`
        : `Delete "${c.title}"? This cannot be undone.`;
    if (!confirm(warn)) return;
    setBusy(c.handle);
    try {
      const res = await fetch(`/api/admin/collections/${c.handle}`, {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Collections ({collections.length})
        </h2>
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
          {creating ? "Cancel" : "New collection"}
        </button>
      </div>

      {creating && (
        <div className="glass  p-6 flex flex-col gap-4">
          <input
            placeholder="Title"
            value={createDraft.title}
            onChange={(e) => setCreateDraft({ ...createDraft, title: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Cover image URL (https://… or /media/…)"
            value={createDraft.image}
            onChange={(e) => setCreateDraft({ ...createDraft, image: e.target.value })}
            className={inputCls}
          />
          <textarea
            placeholder="Description (optional)"
            rows={2}
            value={createDraft.description}
            onChange={(e) =>
              setCreateDraft({ ...createDraft, description: e.target.value })
            }
            className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  p-3 text-sm outline-none focus:border-[var(--border-strong)] transition resize-none"
          />
          {createDraft.title && (
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Handle: /{slugify(createDraft.title)}
            </p>
          )}
          <button
            onClick={createCollection}
            disabled={busy === "__new__" || !createDraft.title}
            style={{ color: "var(--text-on-accent)" }}
            className="self-start bg-[var(--accent-default)] px-5 py-2.5  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy === "__new__" && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {collections.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-6">
            No collections yet. Use the <em>New collection</em> form above to create one.
          </p>
        ) : (
          collections.map((c) => {
            const isEditing = editing === c.handle;
            const isExpanded = expanded === c.handle;
            return (
              <li key={c.handle} className="glass  p-5 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-5">
                  <div className="relative w-full md:w-40 h-40 bg-[var(--surface-card-alt)]  overflow-hidden shrink-0">
                    {c.image && (
                      <Image
                        src={c.image}
                        alt={c.title}
                        fill
                        sizes="160px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {isEditing ? (
                      <>
                        <input
                          value={editDraft.title ?? ""}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, title: e.target.value })
                          }
                          className={inputCls}
                        />
                        <input
                          placeholder="Image URL"
                          value={editDraft.image ?? ""}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, image: e.target.value })
                          }
                          className={inputCls}
                        />
                        <textarea
                          rows={2}
                          placeholder="Description"
                          value={editDraft.description ?? ""}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, description: e.target.value })
                          }
                          className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  p-3 text-sm outline-none focus:border-[var(--border-strong)] transition resize-none"
                        />
                      </>
                    ) : (
                      <>
                        <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-[0.1em]">
                          {c.title}
                        </h3>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">/{c.handle}</p>
                        {c.description && (
                          <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                            {c.description}
                          </p>
                        )}
                        <p className="text-xs text-[var(--text-muted)]">
                          {c.count ?? 0} {c.count === 1 ? "product" : "products"}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap md:flex-col md:flex-nowrap items-stretch gap-2 md:shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(c.handle)}
                          disabled={busy === c.handle}
                          style={{ color: "var(--text-on-accent)" }}
                          className="px-4 py-2 bg-[var(--accent-default)]  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {busy === c.handle && (
                            <Loader2 size={12} className="animate-spin" />
                          )}
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
                        <button
                          onClick={() =>
                            setExpanded((v) => (v === c.handle ? null : c.handle))
                          }
                          className="px-3 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          Manage
                        </button>
                        <button
                          onClick={() => startEdit(c)}
                          className="px-3 py-2 border border-[var(--border-default)] hover:border-[var(--border-strong)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => removeCollection(c)}
                          disabled={busy === c.handle}
                          className="px-3 py-2 border border-[var(--border-default)] hover:border-[var(--accent)] hover:text-[var(--accent)]  text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && !isEditing && (
                  <ManageProducts
                    collection={c}
                    products={products}
                    onChanged={onChanged}
                    onError={onError}
                  />
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function ManageProducts({
  collection,
  products,
  onChanged,
  onError,
}: {
  collection: CollectionMeta;
  products: Product[];
  onChanged: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const inCollection = useMemo(
    () => products.filter((p) => p.collection === collection.handle),
    [products, collection.handle]
  );
  const available = useMemo(
    () => products.filter((p) => p.collection !== collection.handle),
    [products, collection.handle]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    description: "",
    price: "",
    image: "",
  });

  function toggle(handle: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }

  async function assignSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/collections/${collection.handle}/products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productHandles: Array.from(selected) }),
        }
      );
      if (!res.ok) throw new Error((await res.json())?.error ?? "Assign failed");
      setSelected(new Set());
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function createInCollection() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/collections/${collection.handle}/products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newProduct: {
              ...createDraft,
              price: Number(createDraft.price),
            },
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json())?.error ?? "Create failed");
      setCreating(false);
      setCreateDraft({ title: "", description: "", price: "", image: "" });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function unassign(productHandle: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/collections/${collection.handle}/products/${productHandle}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json())?.error ?? "Unassign failed");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unassign failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[var(--border-subtle)] pt-5 flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h4 className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
          In this collection ({inCollection.length})
        </h4>
        {inCollection.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No products yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {inCollection.map((p) => {
              const img = p.media.find((m) => m.type === "image");
              return (
                <li
                  key={p.handle}
                  className="flex items-center gap-3 p-2 border border-[var(--border-subtle)] "
                >
                  <div className="relative w-10 h-10 bg-[var(--surface-card-alt)] rounded overflow-hidden shrink-0">
                    {img && img.type === "image" && (
                      <Image
                        src={img.src}
                        alt={p.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{p.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">/{p.handle}</p>
                  </div>
                  <button
                    onClick={() => unassign(p.handle)}
                    disabled={busy}
                    className="px-3 py-1.5 border border-[var(--border-default)] hover:border-[var(--accent)] hover:text-[var(--accent)] rounded text-[10px] tracking-[0.2em] uppercase disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
          Add existing products
        </h4>
        {available.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            All products are already assigned to a different collection or this one.
          </p>
        ) : (
          <>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {available.map((p) => {
                const img = p.media.find((m) => m.type === "image");
                const checked = selected.has(p.handle);
                return (
                  <li key={p.handle}>
                    <label
                      className={`flex items-center gap-3 p-2 border  cursor-pointer transition ${
                        checked
                          ? "border-[var(--border-default)] bg-[var(--surface-raised)]"
                          : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.handle)}
                        className="accent-[var(--accent-default)]"
                      />
                      <div className="relative w-9 h-9 bg-[var(--surface-card-alt)] rounded overflow-hidden shrink-0">
                        {img && img.type === "image" && (
                          <Image
                            src={img.src}
                            alt={p.title}
                            fill
                            sizes="36px"
                            className="object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{p.title}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                          /{p.collection || "uncategorized"}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={assignSelected}
              disabled={busy || selected.size === 0}
              style={{ color: "var(--text-on-accent)" }}
              className="self-start bg-[var(--accent-default)] px-4 py-2  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              Add {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] tracking-[0.3em] uppercase text-[var(--text-muted)]">
            Create new product in this collection
          </h4>
          <button
            onClick={() => setCreating((v) => !v)}
            className="px-3 py-1.5 border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded text-[10px] tracking-[0.2em] uppercase inline-flex items-center gap-2"
          >
            {creating ? <X size={12} /> : <Plus size={12} />}
            {creating ? "Cancel" : "New"}
          </button>
        </div>
        {creating && (
          <div className="flex flex-col gap-3 p-3 border border-[var(--border-subtle)] ">
            <input
              placeholder="Title"
              value={createDraft.title}
              onChange={(e) =>
                setCreateDraft({ ...createDraft, title: e.target.value })
              }
              className={inputCls}
            />
            <textarea
              placeholder="Description"
              rows={2}
              value={createDraft.description}
              onChange={(e) =>
                setCreateDraft({ ...createDraft, description: e.target.value })
              }
              className="bg-[var(--surface-card-alt)] border border-[var(--border-default)]  p-3 text-sm outline-none focus:border-[var(--border-strong)] transition resize-none"
            />
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                placeholder="Price (EGP)"
                value={createDraft.price}
                onChange={(e) =>
                  setCreateDraft({ ...createDraft, price: e.target.value })
                }
                className={inputCls}
              />
              <input
                placeholder="Image URL"
                value={createDraft.image}
                onChange={(e) =>
                  setCreateDraft({ ...createDraft, image: e.target.value })
                }
                className={inputCls}
              />
            </div>
            <button
              onClick={createInCollection}
              disabled={busy || !createDraft.title || !createDraft.price}
              style={{ color: "var(--text-on-accent)" }}
              className="self-start bg-[var(--accent-default)] px-4 py-2  text-xs tracking-[0.2em] uppercase disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 size={12} className="animate-spin" />}
              Create
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
