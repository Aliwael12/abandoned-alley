import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/products";

export const metadata = { title: "Shop — Abandoned Alley" };

export default function ShopPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-14">
      <div className="flex flex-col items-center gap-3 mb-12">
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
          Abandoned Alley
        </p>
        <h2 className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tracking-[0.18em] uppercase">
          Latest Drop
        </h2>
        <div className="w-12 h-px bg-white/30" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-7">
        {products.map((p) => (
          <ProductCard key={p.handle} product={p} />
        ))}
      </div>
    </div>
  );
}
