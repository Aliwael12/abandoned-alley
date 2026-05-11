import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import PurchaseTracker from "@/components/PurchaseTracker";

export const metadata = { title: "Order placed — Abandoned Alley" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; total?: string; currency?: string }>;
}) {
  const { id, total, currency } = await searchParams;
  const value = total ? Number(total) : 0;
  const cur = currency || "EGP";

  return (
    <div className="max-w-[700px] mx-auto px-4 md:px-8 py-20">
      {id && value > 0 && (
        <PurchaseTracker orderId={id} value={value} currency={cur} />
      )}
      <div className="glass rounded-2xl p-10 md:p-14 flex flex-col items-center gap-6 text-center">
        <CheckCircle2 size={56} className="text-white" strokeWidth={1.2} />
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
          Order received
        </p>
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-5xl tracking-[0.18em] uppercase">
          Thank you
        </h1>
        <div className="w-12 h-px bg-white/30" />
        {id && (
          <p className="text-sm text-white/60">
            Your order reference is{" "}
            <span className="text-white font-mono">#{id}</span>
          </p>
        )}
        <p className="text-white/70 max-w-md leading-relaxed">
          We&apos;ve emailed you a confirmation. Our team will reach out shortly with
          payment and shipping details.
        </p>
        <Link
          href="/shop"
          className="mt-2 px-6 py-3 border border-white/40 hover:border-white rounded-lg transition tracking-[0.2em] text-sm uppercase"
        >
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
