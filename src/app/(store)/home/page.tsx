import type { Metadata } from "next";
import { getActiveProducts } from "@/lib/products-server";
import { getAllCollections } from "@/lib/collections-server";
import HomeContent from "@/components/HomeContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abandoned Alley",
};

export default async function HomePage() {
  const [products, collections] = await Promise.all([
    getActiveProducts(),
    getAllCollections(),
  ]);
  return <HomeContent products={products} collections={collections} />;
}
