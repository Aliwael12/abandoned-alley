import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrderById } from "@/lib/orders-server";
import { getAllProducts } from "@/lib/products-server";
import type { Product } from "@/lib/products";

export const metadata = { title: "Order — Abandoned Alley Admin" };
export const dynamic = "force-dynamic";

const fmt = (n: number, currency: string) =>
  n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 2 });

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const allProducts = await getAllProducts();
  const productMap = new Map<string, Product>(allProducts.map((p) => [p.handle, p]));

  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-12 flex flex-col gap-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-white/60 hover:text-white transition self-start"
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>

      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">Order</p>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-5xl tracking-[0.12em] uppercase">
            #{order.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-white/40 font-mono mt-1">{order.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 text-[11px] tracking-[0.2em] uppercase border border-white/15 rounded">
            {order.status}
          </span>
          <span className="text-xs text-white/60">
            {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}
          </span>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="glass rounded-2xl p-6 flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Customer
          </h2>
          <p className="text-sm text-white/90">{order.customer.name || "—"}</p>
          {order.customer.email && (
            <a
              href={`mailto:${order.customer.email}`}
              className="text-sm text-white/70 hover:text-white transition break-all"
            >
              {order.customer.email}
            </a>
          )}
          {order.customer.phone && (
            <a
              href={`tel:${order.customer.phone}`}
              className="text-sm text-white/70 hover:text-white transition"
            >
              {order.customer.phone}
            </a>
          )}
        </section>

        <section className="glass rounded-2xl p-6 flex flex-col gap-2">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Shipping
          </h2>
          <p className="text-sm text-white/90 leading-relaxed">
            {order.shipping.address}
            <br />
            {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
            <br />
            {order.shipping.country}
          </p>
        </section>
      </div>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em] mb-4">
          Items ({itemCount})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.2em] uppercase text-white/40 border-b border-white/10">
                <th className="text-left py-2 pr-4">Product</th>
                <th className="text-left py-2 pr-4">Variant</th>
                <th className="text-right py-2 pr-4">Qty</th>
                <th className="text-right py-2 pr-4">Price</th>
                <th className="text-right py-2">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => {
                const p = productMap.get(it.productHandle);
                const img = p?.media.find((m) => m.type === "image");
                return (
                  <tr key={it.variantId} className="border-b border-white/5 align-top">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 bg-white/5 rounded overflow-hidden shrink-0">
                          {img && img.type === "image" && (
                            <Image
                              src={img.src}
                              alt={it.title}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white/90">{it.title}</p>
                          <p className="text-[10px] text-white/40 font-mono">
                            /{it.productHandle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-white/70">{it.variantTitle}</td>
                    <td className="py-3 pr-4 text-right">{it.quantity}</td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(it.price, order.currency)}
                    </td>
                    <td className="py-3 text-right">
                      {fmt(it.price * it.quantity, order.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass rounded-2xl p-6 flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Shipping (Droppin)
        </h2>
        {order.droppin.trackingNumber ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-white/60 uppercase tracking-[0.2em] text-xs">
                Tracking
              </span>
              <a
                href={`https://api.droppin-eg.com/api/packages/track/${order.droppin.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-white/90 hover:text-white transition"
              >
                {order.droppin.trackingNumber}
              </a>
            </div>
            {order.droppin.status && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60 uppercase tracking-[0.2em] text-xs">
                  Status
                </span>
                <span>{order.droppin.status}</span>
              </div>
            )}
            {order.droppin.packageId !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60 uppercase tracking-[0.2em] text-xs">
                  Package ID
                </span>
                <span className="font-mono text-white/70">
                  {order.droppin.packageId}
                </span>
              </div>
            )}
            {order.droppin.pushedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60 uppercase tracking-[0.2em] text-xs">
                  Pushed
                </span>
                <span className="text-white/70">
                  {new Date(order.droppin.pushedAt).toLocaleString()}
                </span>
              </div>
            )}
          </>
        ) : order.droppin.error ? (
          <p className="text-sm text-red-300/90">
            Push failed: {order.droppin.error}
          </p>
        ) : (
          <p className="text-sm text-white/50">Not pushed to Droppin yet.</p>
        )}
      </section>

      <section className="glass rounded-2xl p-6 flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Summary
        </h2>
        <div className="flex justify-between text-sm">
          <span className="text-white/60 uppercase tracking-[0.2em] text-xs">Subtotal</span>
          <span>{fmt(order.subtotal, order.currency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60 uppercase tracking-[0.2em] text-xs">Items</span>
          <span>{itemCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60 uppercase tracking-[0.2em] text-xs">Currency</span>
          <span>{order.currency}</span>
        </div>
        {order.notes && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/50 mb-2">
              Notes
            </p>
            <p className="text-sm text-white/80 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </section>
    </div>
  );
}
