import CheckoutClient from "./CheckoutClient";

export const metadata = { title: "Checkout — Abandoned Alley" };

export default function CheckoutPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-14">
      <div className="flex flex-col items-center gap-3 mb-10">
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
          Almost there
        </p>
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tracking-[0.18em] uppercase">
          Checkout
        </h1>
        <div className="w-12 h-px bg-white/30" />
      </div>

      <CheckoutClient />
    </div>
  );
}
