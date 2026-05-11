"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { Loader2 } from "lucide-react";
import { getStoredAttribution } from "@/components/SessionTracker";

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
};

const initial: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  notes: "",
};

export default function CheckoutClient() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [shippingFeeFailed, setShippingFeeFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping-fee", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fee fetch failed"))))
      .then((data: { shippingFee: number }) => {
        if (cancelled) return;
        setShippingFee(Number(data.shippingFee) || 0);
      })
      .catch(() => {
        if (cancelled) return;
        setShippingFeeFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const total = shippingFee !== null ? subtotal + shippingFee : subtotal;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone },
          shipping: {
            address: form.address,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          },
          notes: form.notes || undefined,
          items: items.map((i) => ({
            productHandle: i.productHandle,
            variantId: i.variantId,
            title: i.title,
            variantTitle: i.variantTitle,
            price: i.price,
            quantity: i.quantity,
          })),
          attribution: getStoredAttribution(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Order failed");
      const total = subtotal + (shippingFee ?? 0);
      clear();
      router.push(
        `/checkout/success?id=${encodeURIComponent(data.orderId)}&total=${total}&currency=EGP`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20 text-white/50">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 flex flex-col items-center gap-5 text-center">
        <p className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.2em]">
          Your cart is empty
        </p>
        <p className="text-white/60 text-sm max-w-sm">
          Add something to the cart before you can check out.
        </p>
        <Link
          href="/shop"
          className="px-6 py-3 border border-white/40 hover:border-white rounded-lg transition tracking-[0.2em] text-sm uppercase"
        >
          Shop now
        </Link>
      </div>
    );
  }

  const inputCls =
    "bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition w-full";

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
      {/* Form */}
      <form onSubmit={onSubmit} className="glass rounded-2xl p-7 flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Contact
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputCls}
              autoComplete="name"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputCls}
              autoComplete="email"
            />
          </div>
          <input
            required
            type="tel"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputCls}
            autoComplete="tel"
          />
        </section>

        <div className="h-px bg-white/10" />

        <section className="flex flex-col gap-4">
          <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
            Shipping
          </h2>
          <input
            required
            placeholder="Street address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className={inputCls}
            autoComplete="street-address"
          />
          <div className="grid md:grid-cols-2 gap-4">
            <input
              required
              placeholder="City"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className={inputCls}
              autoComplete="address-level2"
            />
            <input
              required
              placeholder="State / Region"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              className={inputCls}
              autoComplete="address-level1"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              required
              placeholder="ZIP / Postal code"
              value={form.zip}
              onChange={(e) => update("zip", e.target.value)}
              className={inputCls}
              autoComplete="postal-code"
            />
            <input
              required
              placeholder="Country"
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              className={inputCls}
              autoComplete="country-name"
            />
          </div>
          <textarea
            placeholder="Order notes (optional)"
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className="bg-white/5 border border-white/15 rounded-md p-4 outline-none focus:border-white/40 transition resize-none"
          />
        </section>

        {error && (
          <p className="text-sm text-[var(--accent)]">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || shippingFee === null}
          className="w-full bg-white text-black py-4 rounded-lg font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="animate-spin" size={16} />}
          {submitting
            ? "Placing order…"
            : shippingFee === null
            ? shippingFeeFailed
              ? "Shipping unavailable — refresh"
              : "Loading…"
            : `Place order — EGP ${total.toFixed(2)}`}
        </button>

        <p className="text-[11px] text-white/40 text-center">
          We&apos;ll email you confirmation and reach out with payment details.
        </p>
      </form>

      {/* Summary */}
      <aside className="glass rounded-2xl p-7 flex flex-col gap-5 lg:sticky lg:top-24">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.18em]">
          Order summary
        </h2>
        <ul className="flex flex-col gap-4 max-h-[380px] overflow-y-auto">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-4">
              <div className="relative w-16 h-20 bg-white/5 rounded-md overflow-hidden shrink-0">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-black text-[10px] font-bold rounded-full w-5 h-5 grid place-items-center">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 flex flex-col">
                <p className="font-[family-name:var(--font-bebas)] tracking-[0.1em] text-sm">
                  {item.title}
                </p>
                <p className="text-[11px] text-white/50">{item.variantTitle}</p>
                <p className="text-sm mt-auto">
                  EGP {(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 uppercase tracking-[0.2em] text-xs">
            Subtotal
          </span>
          <span>EGP {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 uppercase tracking-[0.2em] text-xs">
            Shipping
          </span>
          <span>
            {shippingFee !== null
              ? `EGP ${shippingFee.toFixed(2)}`
              : shippingFeeFailed
              ? "—"
              : "…"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-[family-name:var(--font-bebas)] tracking-[0.2em] text-lg">
            Total
          </span>
          <span className="font-[family-name:var(--font-bebas)] tracking-[0.1em] text-2xl">
            EGP {total.toFixed(2)}
          </span>
        </div>
      </aside>
    </div>
  );
}
