import { Suspense } from "react";
import ShopContent from "@/components/ShopContent";
import { getActiveProducts } from "@/lib/products-server";
import { getAllCollections } from "@/lib/collections-server";

export const metadata = { title: "Shop — Abandoned Alley" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [products, collections] = await Promise.all([
    getActiveProducts(),
    getAllCollections(),
  ]);
  return (
    <Suspense fallback={null}>
      <ShopContent products={products} collections={collections} />
    </Suspense>
  );
}
