import { collections } from "@/lib/products";
import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Collections — Abandoned Alley" };

export default function CollectionsPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-14">
      <div className="flex flex-col items-center gap-3 mb-12">
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
          Browse the racks
        </p>
        <h2 className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tracking-[0.18em] uppercase">
          Collections
        </h2>
        <div className="w-12 h-px bg-white/30" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {collections.map((c) => (
          <Link
            key={c.handle}
            href={`/collections/${c.handle}`}
            className="group relative block aspect-[4/5] rounded-xl overflow-hidden border border-white/10 bg-white/5"
          >
            <Image
              src={c.image}
              alt={c.title}
              fill
              sizes="(min-width:1024px) 20vw, (min-width:640px) 33vw, 50vw"
              className="object-cover transition duration-500 group-hover:scale-105"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.16em]">
                {c.title}
              </h3>
              <p className="text-xs text-white/60 tracking-[0.2em] uppercase mt-1">
                {c.count} {c.count === 1 ? "item" : "items"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
