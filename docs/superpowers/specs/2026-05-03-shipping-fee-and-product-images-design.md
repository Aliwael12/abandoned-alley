# Admin Shipping Fee & Multi-Image Products

**Date:** 2026-05-03
**Status:** Approved for implementation

## Goal

Two admin capabilities:

1. Admin sets a single global shipping fee from the dashboard. The fee is shown to the customer at checkout, stored on each new order, and sent to Droppin as the delivery cost.
2. Admin manages an ordered list of images per product (add by URL, reorder, choose which one is the "main" card image).

## Context

- Stack: Next.js 16.2.4 (App Router), React 19, Firebase Web SDK (no Admin SDK), TailwindCSS 4.
- Admin auth is the `aa_admin` cookie checked by `isAdmin()` / `requireAdmin()` in [src/lib/admin-auth.ts](../../../src/lib/admin-auth.ts).
- Today's shipping cost is a single env var `DROPPIN_DELIVERY_COST` read inside `buildPackageFromOrder()` in [src/lib/droppin.ts](../../../src/lib/droppin.ts). Customers don't see it; orders don't store it.
- Orders are pushed to Droppin synchronously inside `POST /api/checkout` ([src/app/api/checkout/route.ts](../../../src/app/api/checkout/route.ts)) right after the Firestore order is written.
- `Product.media: Media[]` already supports an ordered list of images and videos. The card already takes the first image (`ProductCard.tsx`); the admin Create/Edit forms only handle a single `image` URL.
- No Firebase Storage is initialized; image inputs are URL-based throughout.

---

## 1. Shipping Fee

### Storage

New Firestore document: `settings/store`.

```ts
{
  shippingFee: number;       // EGP, integer or decimal, >= 0
  updatedAt: Timestamp;
}
```

If the doc is missing, callers default to `0`. The `DROPPIN_DELIVERY_COST` env var is removed from the codebase — once the `settings/store` doc exists, it is the only source of truth.

### Helper

New file `src/lib/settings-server.ts`:

```ts
export async function getShippingFee(): Promise<number>;
export async function setShippingFee(value: number): Promise<void>;
```

`getShippingFee` reads `doc(db, "settings", "store")`, returns `Number(data.shippingFee) || 0` if the doc or field is missing or non-finite. `setShippingFee` writes `{ shippingFee, updatedAt: serverTimestamp() }` via `setDoc(..., { merge: true })`.

### Order doc — new field

`shippingFee: number` is added to the order document on creation, snapshotting the value of `getShippingFee()` at checkout time. Subtotal is unchanged. **No `total` field is stored** — `total = subtotal + shippingFee` is computed wherever displayed.

`OrderDetail` (in [src/lib/orders-server.ts](../../../src/lib/orders-server.ts)) gains `shippingFee: number` (defaults to `0` for legacy orders that don't have the field).

### Checkout flow change

In `POST /api/checkout` ([src/app/api/checkout/route.ts](../../../src/app/api/checkout/route.ts)):

1. After computing `subtotal`, call `getShippingFee()` once.
2. Persist `shippingFee` on the order doc alongside `subtotal`.
3. Pass `shippingFee` into `buildPackageFromOrder()` (new parameter on `OrderForDroppin`) so Droppin receives `deliveryCost` / `shownDeliveryCost` / `codAmount = subtotal + shippingFee` based on it.
4. Include `shippingFee` and the computed `total` in the `OrderForEmail` payload.

`buildPackageFromOrder()` in [src/lib/droppin.ts](../../../src/lib/droppin.ts) is changed to read `shippingFee` from its `OrderForDroppin` argument instead of `process.env.DROPPIN_DELIVERY_COST`. The env-var read is removed.

### Public API

New route `GET /api/shipping-fee` (no auth, public). Returns `{ shippingFee: number }`. Used by the checkout page to render the line item without exposing the rest of the settings doc.

### Admin API

New routes under `/api/admin/settings`:

- `GET` → `{ shippingFee: number }`
- `PUT` → body `{ shippingFee: number }`. Validates `Number.isFinite(v) && v >= 0`. Returns `{ ok: true, shippingFee }`.

Both gated by `isAdmin()`.

### Admin UI

New tab `Settings` added to `AdminDashboard.tsx`:

- Tab id `"settings"`, label `"Settings"`, icon `Settings` from `lucide-react`.
- Tab order: Overview, Products, Collections, Broadcast, **Settings**.
- New file `src/app/admin/tabs/SettingsTab.tsx`. Single number input (EGP), step `0.01`, min `0`, plus a Save button. Loads current value on mount; shows a small "Saved" confirmation on success. Errors propagate via the existing `onError` prop pattern used by other tabs.

### Customer surfaces

**Checkout** (`src/app/checkout/CheckoutClient.tsx`):

- On mount, fetch `GET /api/shipping-fee`, store in local state.
- In the order summary, render a **Shipping** line between Subtotal and Total: `Shipping  EGP 0.00` (if `0`, still show the line — transparency).
- Render **Total** as `subtotal + shippingFee`.
- If the fetch fails, show shipping as `—` and disable the submit button (we never want to push an order to Droppin without knowing the fee).

**Cart drawer** (`src/components/CartDrawer.tsx`): inspect during implementation. If it shows a total, mirror the Subtotal / Shipping / Total layout. If it only shows subtotal today, leave it — the customer sees shipping clearly at checkout.

**Order confirmation emails** ([src/lib/email.ts](../../../src/lib/email.ts)): both `customerOrderHtml` and `adminOrderHtml` add a Shipping line above the Total line. `OrderForEmail` gains `shippingFee: number`.

**Admin order detail page** ([src/app/admin/orders/[id]/page.tsx](../../../src/app/admin/orders/[id]/page.tsx)): in the Summary section, add a Shipping line and a Total line below Subtotal.

---

## 2. Multiple Product Images

### Data model

No schema change. `Product.media: Media[]` already exists and is ordered. The convention is **tightened to: `media[0]` is always the main card image**. `ProductCard` is unchanged in behavior — it already picks the first image — but we'll simplify the lookup to `product.media[0]` (with a guard for the rare case where index 0 is a video, in which case fall back to the first image entry).

### Admin UI — image list editor

In [src/app/admin/tabs/ProductsTab.tsx](../../../src/app/admin/tabs/ProductsTab.tsx), both the Create form and the Edit form replace the single `image` URL input with an image list editor.

State shape (local to the form):

```ts
type DraftMedia = Media; // reuse the canonical type
images: DraftMedia[];
```

Editor behavior:

- **Add row:** A URL input + "Add" button below the list. On click, validates the URL is non-empty, appends `{ type: "image", src, alt: title }` to the list.
- **Each row** shows:
  - Thumbnail (40×40, `next/image` with `unoptimized`). For videos, show a small "VIDEO" badge instead of a thumbnail.
  - Truncated URL (monospace, ellipsis).
  - `↑` and `↓` buttons (disabled at edges) to swap with the neighbor.
  - `Set main` button — no-op (and visually muted) if already index 0; otherwise moves the row to index 0.
  - `Remove` button (with confirm if it's the only image).
- **Index 0** has a small `MAIN` badge in the row.
- **Empty state:** "No images yet — add one below."

The Create form initializes `images` to `[]`. The Edit form initializes from the existing product's `media`.

### API changes

`POST /api/admin/products` ([src/app/api/admin/products/route.ts](../../../src/app/api/admin/products/route.ts)):

- Accept `media: Media[]` in the body. Each entry must have a string `type` (`"image"` or `"video"`) and a non-empty string `src`. Reject otherwise with `400`.
- Continue to accept the legacy `image: string` field for back-compat **only during the transition**: if `media` is absent and `image` is present, build a single-element `media` array as today. The admin UI stops sending `image` once this lands.
- `media` is required to be a non-empty array if provided (no need to allow empty media on create — at least one image is expected).

`PATCH /api/admin/products/[handle]` ([src/app/api/admin/products/[handle]/route.ts](../../../src/app/api/admin/products/[handle]/route.ts)):

- Accept optional `media: Media[]`. When provided (even as an empty array — admin may want to clear), replace `next.media` wholesale.
- Keep the legacy `image: string` branch for back-compat.

Both routes preserve the existing `isAdmin()` gate, validation patterns, and `slugify` logic.

### Storefront

No changes needed:

- `ProductCard.tsx` already picks the first image.
- `ProductDetail.tsx` already iterates `media[]` in order.

The admin's reorder action takes effect immediately because both surfaces read the same array.

### Admin product list thumbnail

Already uses `p.media.find(m => m.type === "image")`. Works unchanged. We don't need to switch it to `media[0]` because it's purely cosmetic for the admin list — the storefront card is what matters.

---

## Out of scope

- Per-order shipping fee overrides.
- Uploading image files (Firebase Storage / Vercel Blob). Image inputs remain URL-based.
- Adding new video media through the admin UI. Existing video entries in seed products keep working and can be reordered/removed via the editor.
- Backfilling `shippingFee` on legacy orders. Old orders show `shippingFee = 0` (the default) on the detail page.
- Currency / multi-currency support. EGP throughout, matching today.

## Testing notes

- Manual test flow: set shipping fee in admin → place an order → verify Subtotal/Shipping/Total in checkout summary, both emails, and the admin order detail page. Verify Droppin push uses the fee (check the order's `droppinPackageId` and the `codAmount` reflected in Droppin if accessible).
- Manual test for images: create a product with three image URLs, reorder so URL #2 becomes main, verify the storefront card shows it and the product detail page lists them in the new order. Edit the product, remove one, verify it disappears everywhere.
