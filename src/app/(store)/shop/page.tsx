import { Suspense } from "react";
import ShopContent from "@/components/ShopContent";
import { getActiveProducts } from "@/lib/products-server";

export const metadata = { title: "Shop — Abandoned Alley" };
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await getActiveProducts();
  return (
    <Suspense fallback={null}>
      <ShopContent products={products} />
    </Suspense>
  );
}
