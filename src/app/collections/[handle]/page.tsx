import ProductCard from "@/components/ProductCard";
import { collections, products } from "@/lib/products";
import Image from "next/image";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const c = collections.find((x) => x.handle === handle);
  return { title: c ? `${c.title} — Abandoned Alley` : "Collection — Abandoned Alley" };
}

export default async function CollectionDetail({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const meta = collections.find((c) => c.handle === handle);
  if (!meta) notFound();
  const items = products.filter((p) => p.collection === handle);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-14">
      <div className="relative h-[42vh] min-h-[280px] rounded-2xl overflow-hidden mb-12 border border-white/10">
        <Image
          src={meta.image}
          alt={meta.title}
          fill
          priority
          sizes="100vw"
          className="object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center text-center px-6">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/70 mb-2">
            Collection
          </p>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl md:text-7xl tracking-[0.14em] uppercase">
            {meta.title}
          </h1>
          <p className="mt-3 text-white/70 text-sm tracking-[0.18em] uppercase">
            {meta.count} pieces · drop 001
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-white/50">No items in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-7">
          {items.map((p) => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
