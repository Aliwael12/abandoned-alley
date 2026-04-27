# Admin Order Detail Page & Collections Management

**Date:** 2026-04-28
**Status:** Approved for implementation

## Goal

Two admin capabilities:

1. Click an order in the admin dashboard to open a dedicated page showing the full order details and the customer who placed it.
2. Manage collections from the admin: create a collection, add existing products to it, or create a new product directly into it.

## Context

- Stack: Next.js 16.2.4 (App Router), React 19, Firebase Web SDK (no Admin SDK), TailwindCSS 4.
- Admin auth is a single cookie (`aa_admin`) checked by `isAdmin()` / `requireAdmin()` in [src/lib/admin-auth.ts](../../../src/lib/admin-auth.ts).
- Orders already store full customer + shipping + items + notes ([api/checkout/route.ts:110-119](../../../src/app/api/checkout/route.ts#L110-L119)).
- Products live in Firestore `products` with a `collection: string` handle field; a hardcoded fallback list is in [src/lib/products.ts](../../../src/lib/products.ts).
- Collections are currently **hardcoded** in `src/lib/products.ts` — no Firestore collection exists for them.
- Storefront pages [src/app/collections/page.tsx](../../../src/app/collections/page.tsx) and `src/app/collections/[handle]/page.tsx` read the hardcoded list.

## 1. Order Detail Page

### Route

`/admin/orders/[id]` — server component, calls `await requireAdmin()` first (matches the pattern in [src/app/admin/page.tsx](../../../src/app/admin/page.tsx)).

### Data

New API route: `GET /api/admin/orders/[id]`
- Auth: `isAdmin()` gate, returns 401 if not.
- Reads `doc(db, "orders", id)`. Returns 404 if not found.
- Normalizes `createdAt` (Firestore `Timestamp`) to milliseconds, same as the list endpoint.
- Response shape:
  ```ts
  type OrderDetail = {
    id: string;
    customer: { name: string; email: string; phone: string };
    shipping: { address: string; city: string; state: string; zip: string; country: string };
    items: { productHandle: string; variantId: string; title: string; variantTitle: string; price: number; quantity: number }[];
    notes: string | null;
    subtotal: number;
    currency: string;
    status: string;
    createdAt: number | null;
  };
  ```

The page fetches this from the server component using the request URL's host (or directly reads Firestore in a small server-side helper to avoid the round-trip — preferred). Add a server helper `getOrderById(id)` in a new `src/lib/orders-server.ts` and call it directly from the page.

### UI

Single-column layout, matching admin styling (`glass` cards, Bebas display font, `[0.18em]` tracking on headers).

Sections:
1. **Header** — order id, status badge, created date, "Back to dashboard" link.
2. **Customer card** — name, email (mailto link), phone (tel link).
3. **Shipping card** — full address block, country.
4. **Line items table** — product image (lookup via existing `getProductByHandle`), title, variant, qty, unit price, line total.
5. **Summary card** — subtotal, item count, currency, notes (if any).

### Linking from the dashboard

In [OverviewTab.tsx](../../../src/app/admin/tabs/OverviewTab.tsx), wrap each `<tr>` row (or the order id cell at minimum) with a `<Link href={`/admin/orders/${o.id}`}>`. Visible cursor + hover state on rows.

## 2. Collections in Admin

### Storage

New Firestore collection `collections`. Each doc keyed by `handle`:

```ts
type CollectionDoc = {
  handle: string;       // slug, primary key
  title: string;
  image: string;        // URL or /media/... path
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

`count` is **derived**, never stored. Computed by counting active products whose `collection === handle`.

### Server helper

New file `src/lib/collections-server.ts`:

```ts
getAllCollections(): Promise<CollectionMeta[]>
getCollectionByHandle(handle: string): Promise<CollectionMeta | null>
upsertCollection(c: CollectionMeta): Promise<void>
deleteCollection(handle: string): Promise<void>
```

Falls back to the hardcoded `collections` array in `src/lib/products.ts` if Firestore is empty (mirrors `products-server.ts`).

`CollectionMeta` is `CollectionDoc` minus the timestamps, plus an optional `count?: number` populated by the caller when it has product data on hand.

### API routes

All routes gated with `isAdmin()`, returning 401 otherwise.

- `GET /api/admin/collections` — `{ collections: CollectionMeta[] }` with `count` populated.
- `POST /api/admin/collections` — body `{ title, image, description?, handle? }`. Slugify title if no handle. Reject if handle already exists.
- `PATCH /api/admin/collections/[handle]` — body subset of `{ title, image, description }`. 404 if missing.
- `DELETE /api/admin/collections/[handle]` — deletes the doc. Returns `{ ok: true, productCount }` so the UI can warn the admin if products still reference it. Does NOT cascade-update products; admin must reassign manually (safer default).
- `POST /api/admin/collections/[handle]/products` — body `{ productHandles?: string[], newProduct?: { title, description, price, image } }`.
  - For each handle in `productHandles`: load product, set `collection = handle`, save.
  - If `newProduct` provided, create it (re-using the same logic as the existing `POST /api/admin/products`) with `collection` pre-set to `handle`.
  - Returns `{ ok: true, assigned: string[], created?: Product }`.
- `DELETE /api/admin/collections/[handle]/products/[productHandle]` — un-assigns by setting that product's `collection` to `""` (treated as "uncategorized" in storefront).

### UI

New file `src/app/admin/tabs/CollectionsTab.tsx` and add `"collections"` to the `Tab` union in [AdminDashboard.tsx](../../../src/app/admin/AdminDashboard.tsx) (between Products and Promo email; lucide icon `Layers`).

Layout:
- **Header row** — "Collections (n)" + "New collection" button (toggles inline create form).
- **Create form** — Title, Image URL, Description (optional). Handle auto-derived from title (read-only preview).
- **Collection list** — each `glass` card shows cover thumbnail, title, handle, product count, and Edit / Manage products / Delete buttons.
- **Manage products view** (expanded inline or modal — inline preferred for consistency with ProductsTab):
  - List of currently assigned products with "Remove" button each.
  - "Add existing product" — multi-select from products NOT already in this collection.
  - "Create new product" — collapsible form mirroring the Products tab's create form, with `collection` field hidden (pre-filled to this handle).

The dashboard already loads `products` on `refresh()`. Extend `refresh()` to also load `collections` and pass them to the new tab.

### Storefront integration

- Update [src/app/collections/page.tsx](../../../src/app/collections/page.tsx) to call `getAllCollections()` and `getActiveProducts()`, computing `count` per collection by filtering products.
- Update `src/app/collections/[handle]/page.tsx` to call `getCollectionByHandle(handle)` and `notFound()` if missing.
- Hardcoded `collections` array in `src/lib/products.ts` stays as the fallback seed.

### Firestore rules

Add to [firestore.rules](../../../firestore.rules), mirroring the `products` block:

```
match /collections/{handle} {
  allow read: if true;
  allow create, update, delete: if true;
}
```

Same MVP trade-off as products; the existing "tighten before launch" warning at the top of the file covers it.

## Out of scope

- Order editing (status changes, refunds, fulfillment). Read-only detail page only.
- Cascading collection deletion — when a collection is deleted, its products are *not* automatically reassigned. Admin reassigns manually.
- Bulk product re-categorization across collections from the Products tab — this is reachable via the Collections tab.
- Image upload — both products and collections continue to use URL strings (existing pattern).
- Pagination on the collections / orders lists — not needed at current scale.

## Risks & open questions

- Firestore Web SDK writes for collections are open (same risk that already exists for products). Acceptable for MVP per the comment block in `firestore.rules`.
- Deleting a collection that still has products leaves those products with a dangling `collection` handle. Storefront filtering tolerates this (they just don't appear under any collection). The DELETE response includes `productCount` so the admin sees the consequence.
