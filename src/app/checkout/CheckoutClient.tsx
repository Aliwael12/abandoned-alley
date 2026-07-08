"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { trackPixel, PIXEL_CURRENCY } from "@/lib/pixel";
import { Loader2, Clock, Info } from "lucide-react";
import { getStoredAttribution } from "@/components/SessionTracker";
import {
  COUNTRY_EGYPT,
  COUNTRY_OTHER,
  EGYPT_GOVERNORATES,
  feeForZone,
  resolveZone,
  type ShippingFees,
} from "@/lib/shipping";

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
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
  governorate: "",
  zip: "",
  country: COUNTRY_EGYPT,
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
  const [fees, setFees] = useState<ShippingFees | null>(null);
  const [feesFailed, setFeesFailed] = useState(false);

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
      .then((data: { metroShippingFee: number; outerShippingFee: number }) => {
        if (cancelled) return;
        setFees({
          metro: Number(data.metroShippingFee) || 0,
          outer: Number(data.outerShippingFee) || 0,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFeesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const zone = useMemo(
    () => resolveZone(form.country, form.governorate),
    [form.country, form.governorate]
  );
  const isEgypt = form.country === COUNTRY_EGYPT;
  const isInternational = form.country === COUNTRY_OTHER;
  // Fee is known only once a governorate has been picked for an Egyptian order.
  const shippingFee =
    fees && isEgypt && form.governorate ? feeForZone(zone, fees) : null;

  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const total = shippingFee !== null ? subtotal + shippingFee : subtotal;

  // InitiateCheckout: fires once, after hydration, when the page loads with a
  // non-empty cart. Guarded so re-renders (typing, fee fetch) don't re-fire it.
  const initiateCheckoutFired = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) return;
    if (initiateCheckoutFired.current) return;
    initiateCheckoutFired.current = true;
    trackPixel("InitiateCheckout", {
      content_ids: items.map((i) => i.variantId),
      contents: items.map((i) => ({ id: i.variantId, quantity: i.quantity })),
      content_type: "product",
      num_items: items.reduce((n, i) => n + i.quantity, 0),
      value: subtotal,
      currency: PIXEL_CURRENCY,
    });
  }, [hydrated, items, subtotal]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit =
    !submitting &&
    fees !== null &&
    isEgypt &&
    !!form.governorate &&
    shippingFee !== null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isInternational) {
      setError("We currently deliver within Egypt only.");
      return;
    }
    if (!form.governorate) {
      setError("Please select your governorate.");
      return;
    }
    setError(null);
    setSubmitting(true);
    // AddPaymentInfo: the shopper has completed the form and committed to the
    // order. This is a cash-on-delivery flow (no card-entry step), so submit is
    // the point at which they provide their payment/fulfilment details.
    trackPixel("AddPaymentInfo", {
      content_ids: items.map((i) => i.variantId),
      contents: items.map((i) => ({ id: i.variantId, quantity: i.quantity })),
      content_type: "product",
      num_items: items.reduce((n, i) => n + i.quantity, 0),
      value: subtotal + (shippingFee ?? 0),
      currency: PIXEL_CURRENCY,
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone },
          shipping: {
            address: form.address,
            city: form.city,
            state: form.governorate,
            zip: form.zip,
            country: COUNTRY_EGYPT,
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
      const orderTotal = subtotal + (shippingFee ?? 0);
      clear();
      router.push(
        `/checkout/success?id=${encodeURIComponent(data.orderId)}&total=${orderTotal}&currency=EGP`
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
  const selectCls = `${inputCls} appearance-none text-white`;
  const optionCls = "bg-[#0a0a0a] text-white";

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

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.3em] uppercase text-white/50">
              Country
            </span>
            <select
              required
              value={form.country}
              onChange={(e) => {
                update("country", e.target.value);
                if (e.target.value !== COUNTRY_EGYPT) update("governorate", "");
                setError(null);
              }}
              className={selectCls}
              autoComplete="country-name"
            >
              <option className={optionCls} value={COUNTRY_EGYPT}>
                Egypt
              </option>
              <option className={optionCls} value={COUNTRY_OTHER}>
                Outside Egypt
              </option>
            </select>
          </label>

          {isInternational && (
            <div className="flex items-start gap-2.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 text-sm text-white/80">
              <Info size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span>
                We currently deliver within Egypt only. Checkout is unavailable
                for international addresses.
              </span>
            </div>
          )}

          {isEgypt && (
            <>
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
                  placeholder="City / Area"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className={inputCls}
                  autoComplete="address-level2"
                />
                <label className="flex flex-col gap-1.5">
                  <select
                    required
                    value={form.governorate}
                    onChange={(e) => {
                      update("governorate", e.target.value);
                      setError(null);
                    }}
                    className={selectCls}
                    autoComplete="address-level1"
                  >
                    <option className={optionCls} value="" disabled>
                      Select governorate
                    </option>
                    {EGYPT_GOVERNORATES.map((g) => (
                      <option key={g} className={optionCls} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input
                placeholder="ZIP / Postal code (optional)"
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                className={inputCls}
                autoComplete="postal-code"
              />

              {zone === "egypt" && (
                <div className="flex items-start gap-2.5 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/75">
                  <Clock size={16} className="mt-0.5 shrink-0 text-white/60" />
                  <span>
                    Estimated delivery to {form.governorate}:{" "}
                    <strong className="text-white">3–5 business days</strong>.
                  </span>
                </div>
              )}

              <textarea
                placeholder="Order notes (optional)"
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className="bg-white/5 border border-white/15 rounded-md p-4 outline-none focus:border-white/40 transition resize-none"
              />
            </>
          )}
        </section>

        {error && <p className="text-sm text-[var(--accent)]">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-white text-black py-4 rounded-lg font-[family-name:var(--font-bebas)] tracking-[0.2em] uppercase hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="animate-spin" size={16} />}
          {submitting
            ? "Placing order…"
            : isInternational
            ? "Egypt delivery only"
            : fees === null
            ? feesFailed
              ? "Shipping unavailable — refresh"
              : "Loading…"
            : !form.governorate
            ? "Select governorate to continue"
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
              : isInternational
              ? "Unavailable"
              : feesFailed
              ? "—"
              : form.governorate
              ? "…"
              : "Select governorate"}
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
