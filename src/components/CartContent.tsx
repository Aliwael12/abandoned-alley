"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { trackPixel } from "@/lib/pixel";
import { useRegionOrDefault } from "@/lib/region";
import { formatMoney, REGION_CURRENCY } from "@/lib/pricing";
import { getStoredAttribution } from "@/components/SessionTracker";
import {
  COUNTRY_EGYPT,
  COUNTRY_OTHER,
  COUNTRY_USA,
  EGYPT_GOVERNORATES,
  feeForZone,
  resolveZone,
  type ShippingFees,
} from "@/lib/shipping";
import { Button, Card, Input } from "./ui";
import PurchaseTracker from "./PurchaseTracker";

type Step = "cart" | "checkout" | "confirmed";

type FormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  governorate: string;
  /** US state. Kept separate from `governorate` so neither region's value leaks into the other. */
  state: string;
  zip: string;
  country: string;
  notes: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  governorate: "",
  state: "",
  zip: "",
  country: COUNTRY_EGYPT,
  notes: "",
};

export default function CartContent() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  const [step, setStep] = useState<Step>("cart");
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fees, setFees] = useState<ShippingFees | null>(null);
  const [feesFailed, setFeesFailed] = useState(false);
  const [order, setOrder] = useState<{ id: string; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping-fee", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fee fetch failed"))))
      .then((data: { metroShippingFee: number; outerShippingFee: number }) => {
        if (cancelled) return;
        setFees({ metro: Number(data.metroShippingFee) || 0, outer: Number(data.outerShippingFee) || 0 });
      })
      .catch(() => {
        if (cancelled) return;
        setFeesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const region = useRegionOrDefault();
  const isUs = region === "us";
  const currency = REGION_CURRENCY[region];
  const money = (n: number) => formatMoney(n, region);

  const zone = useMemo(() => resolveZone(form.country, form.governorate), [form.country, form.governorate]);
  const isEgypt = !isUs && form.country === COUNTRY_EGYPT;
  const isInternational = !isUs && form.country === COUNTRY_OTHER;
  // US orders are recorded for manual follow-up rather than dispatched to a
  // carrier, so they carry no shipping fee.
  const shippingFee = isUs
    ? 0
    : fees && isEgypt && form.governorate
      ? feeForZone(zone, fees)
      : null;

  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const total = shippingFee !== null ? subtotal + shippingFee : subtotal;

  const initiateCheckoutFired = useRef(false);
  useEffect(() => {
    if (step !== "checkout") return;
    if (initiateCheckoutFired.current) return;
    initiateCheckoutFired.current = true;
    trackPixel("InitiateCheckout", {
      content_ids: items.map((i) => i.variantId),
      contents: items.map((i) => ({ id: i.variantId, quantity: i.quantity })),
      content_type: "product",
      num_items: items.reduce((n, i) => n + i.quantity, 0),
      value: subtotal,
      currency,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit =
    !submitting &&
    !!form.name.trim() &&
    !!form.email.trim() &&
    !!form.phone.trim() &&
    !!form.address.trim() &&
    !!form.city.trim() &&
    (isUs
      ? !!form.state.trim() && !!form.zip.trim()
      : fees !== null &&
        isEgypt &&
        !!form.governorate &&
        shippingFee !== null);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    trackPixel("AddPaymentInfo", {
      content_ids: items.map((i) => i.variantId),
      contents: items.map((i) => ({ id: i.variantId, quantity: i.quantity })),
      content_type: "product",
      num_items: items.reduce((n, i) => n + i.quantity, 0),
      value: total,
      currency,
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone },
          region,
          shipping: {
            address: form.address,
            city: form.city,
            state: isUs ? form.state : form.governorate,
            zip: form.zip,
            country: isUs ? COUNTRY_USA : COUNTRY_EGYPT,
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
      clear();
      setOrder({ id: data.orderId, total });
      setStep("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const zipLabel = isUs ? "ZIP code" : "Postal code (optional)";

  return (
    <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
      {step === "cart" && (
        <>
          <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginBottom: "var(--space-8)" }}>
            YOUR BAG
          </h1>

          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-24) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
              <div className="aa-eyebrow">NOTHING HERE</div>
              <h2 className="aa-display-h2">YOUR BAG IS EMPTY</h2>
              <Link href="/shop"><Button variant="primary" size="lg">CONTINUE SHOPPING</Button></Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "var(--space-10)" }} className="aa-cart-grid">
              <Card style={{ padding: 0 }}>
                {items.map((item, i) => (
                  <div
                    key={item.variantId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "96px 1fr auto",
                      gap: "var(--space-4)",
                      padding: "var(--space-5)",
                      borderBottom: i < items.length - 1 ? "1px solid var(--border-default)" : "none",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ position: "relative", width: 96, height: 120, background: "var(--surface-card-alt)" }}>
                      <Image src={item.image} alt={item.title} fill sizes="96px" style={{ objectFit: "cover" }} unoptimized />
                    </div>
                    <div>
                      <h3 className="aa-display-h3" style={{ fontSize: "var(--text-md)" }}>{item.title}</h3>
                      <p className="aa-caption" style={{ marginTop: "var(--space-1)" }}>{item.variantTitle}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setQty(item.variantId, item.quantity - 1)} aria-label="Decrease quantity">−</Button>
                        <span className="aa-body">{item.quantity}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setQty(item.variantId, item.quantity + 1)} aria-label="Increase quantity">+</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(item.variantId)}>
                          REMOVE
                        </Button>
                      </div>
                    </div>
                    <p className="aa-price" style={{ textAlign: "right" }}>{money(item.price * item.quantity)}</p>
                  </div>
                ))}
              </Card>

              <Card>
                <h2 className="aa-display-h3" style={{ marginBottom: "var(--space-4)" }}>ORDER SUMMARY</h2>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span className="aa-caption">SUBTOTAL</span>
                  <span className="aa-body">{money(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
                  <span className="aa-caption">SHIPPING</span>
                  <span className="aa-body" style={{ color: "var(--text-muted)" }}>Calculated at checkout</span>
                </div>
                <div style={{ height: 1, background: "var(--border-default)", marginBottom: "var(--space-4)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
                  <span className="aa-display-h3">TOTAL</span>
                  <span className="aa-price" style={{ fontSize: "var(--text-lg)" }}>{money(subtotal)}</span>
                </div>
                <Button variant="primary" size="lg" style={{ width: "100%" }} onClick={() => setStep("checkout")}>
                  CHECKOUT
                </Button>
              </Card>
            </div>
          )}
        </>
      )}

      {step === "checkout" && (
        <>
          <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginBottom: "var(--space-8)" }}>
            CHECKOUT
          </h1>
          <form
            onSubmit={placeOrder}
            style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-10)" }}
            className="aa-cart-grid"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div className="aa-eyebrow">SHIPPING TO — {isUs ? "UNITED STATES" : "EGYPT"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }} className="aa-cart-grid">
                  <Input required placeholder="Full name" value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" />
                  <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" />
                </div>
                <Input required type="tel" placeholder="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" />
                {!isUs && (
                  <select
                    required
                    value={form.country}
                    onChange={(e) => {
                      update("country", e.target.value);
                      if (e.target.value !== COUNTRY_EGYPT) update("governorate", "");
                    }}
                    className="aa-input"
                  >
                    <option value={COUNTRY_EGYPT}>Egypt</option>
                    <option value={COUNTRY_OTHER}>Outside Egypt</option>
                  </select>
                )}

                {isInternational && (
                  <p className="aa-caption" style={{ color: "var(--accent-default)" }}>
                    We currently deliver within Egypt only. Checkout is unavailable for international addresses.
                  </p>
                )}

                {(isEgypt || isUs) && (
                  <>
                    <Input required placeholder="Street address" value={form.address} onChange={(e) => update("address", e.target.value)} autoComplete="street-address" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }} className="aa-cart-grid">
                      <Input required placeholder="City / Area" value={form.city} onChange={(e) => update("city", e.target.value)} autoComplete="address-level2" />
                      {isUs ? (
                        <Input
                          required
                          placeholder="State"
                          value={form.state}
                          onChange={(e) => update("state", e.target.value)}
                          autoComplete="address-level1"
                        />
                      ) : (
                        <select
                          required
                          value={form.governorate}
                          onChange={(e) => update("governorate", e.target.value)}
                          className="aa-input"
                        >
                          <option value="" disabled>Select governorate</option>
                          {EGYPT_GOVERNORATES.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <Input required={isUs} placeholder={zipLabel} value={form.zip} onChange={(e) => update("zip", e.target.value)} autoComplete="postal-code" />
                    {!isUs && zone === "egypt" && (
                      <p className="aa-caption">Estimated delivery to {form.governorate}: 3–5 business days.</p>
                    )}
                  </>
                )}
              </Card>

              <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div className="aa-eyebrow">PAYMENT</div>
                <p className="aa-body">Cash on delivery.</p>
                <p className="aa-caption">
                  {isUs
                    ? "Nothing is charged now — we'll contact you to confirm your order and arrange delivery."
                    : "Pay the courier in cash when your order arrives. Nothing is charged now."}
                </p>
              </Card>

              {error && <p className="aa-caption" style={{ color: "var(--graphic-red)" }}>{error}</p>}

              <button type="button" onClick={() => setStep("cart")} className="aa-nav-link" style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", alignSelf: "flex-start" }}>
                ← BACK TO BAG
              </button>
            </div>

            <Card style={{ alignSelf: "start" }}>
              <h2 className="aa-display-h3" style={{ marginBottom: "var(--space-4)" }}>ORDER SUMMARY</h2>
              {items.map((i) => (
                <div key={i.variantId} style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                  <span className="aa-body" style={{ color: "var(--text-muted)" }}>
                    {i.title} × {i.quantity} ({i.variantTitle})
                  </span>
                  <span className="aa-body">{money(i.price * i.quantity)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "var(--border-default)", margin: "var(--space-4) 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span className="aa-caption">SUBTOTAL</span>
                <span className="aa-body">{money(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
                <span className="aa-caption">SHIPPING</span>
                <span className="aa-body">
                  {shippingFee !== null
                    ? money(shippingFee)
                    : isInternational
                    ? "Unavailable"
                    : feesFailed
                    ? "—"
                    : form.governorate
                    ? "…"
                    : "Select governorate"}
                </span>
              </div>
              <div style={{ height: 1, background: "var(--border-default)", marginBottom: "var(--space-4)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
                <span className="aa-display-h3">TOTAL</span>
                <span className="aa-price" style={{ fontSize: "var(--text-lg)" }}>{money(total)}</span>
              </div>
              <Button type="submit" variant="primary" size="lg" style={{ width: "100%" }} disabled={!canSubmit}>
                {submitting
                  ? "PLACING ORDER…"
                  : isInternational
                  ? "EGYPT DELIVERY ONLY"
                  : fees === null
                  ? "LOADING…"
                  : !form.governorate
                  ? "SELECT GOVERNORATE"
                  : "PLACE ORDER"}
              </Button>
            </Card>
          </form>
        </>
      )}

      {step === "confirmed" && order && (
        <div style={{ textAlign: "center", padding: "var(--space-24) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <PurchaseTracker orderId={order.id} value={order.total} currency={currency} />
          <Image src="/brand/logo-solid-black.png" alt="Abandoned Alley" width={56} height={56} />
          <div className="aa-eyebrow">ORDER CONFIRMED</div>
          <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)" }}>DON&apos;T DIE WONDERING</h1>
          <p className="aa-numeric" style={{ fontSize: "var(--text-md)" }}>ORDER #{order.id}</p>
          <p className="aa-body" style={{ color: "var(--text-muted)", maxWidth: 420 }}>
            We&apos;ll email tracking once it ships from Cairo.
          </p>
          <Link href="/shop"><Button variant="primary" size="lg">CONTINUE SHOPPING</Button></Link>
        </div>
      )}
    </div>
  );
}
