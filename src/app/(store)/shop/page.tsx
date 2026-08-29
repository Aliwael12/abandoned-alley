import { Suspense } from "react";
import ShopContent from "@/components/ShopContent";
import RegionGate from "@/components/RegionGate";
import { getActiveProducts } from "@/lib/products-server";
import { getAllCollections } from "@/lib/collections-server";

export const metadata = { title: "Shop — Abandoned Alley" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [products, collections] = await Promise.all([
    getActiveProducts(),
    getAllCollections(),
  ]);
  const collectionTitles = Object.fromEntries(
    collections.map((c) => [c.handle, c.title])
  );
  return (
    <RegionGate>
      <Suspense fallback={null}>
        <ShopContent products={products} collectionTitles={collectionTitles} />
      </Suspense>
    </RegionGate>
  );
}
