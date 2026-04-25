import ProductDetail from "@/components/ProductDetail";
import { getProduct, products } from "@/lib/products";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = getProduct(handle);
  return {
    title: product ? `${product.title} — Abandoned Alley` : "Product — Abandoned Alley",
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = getProduct(handle);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
