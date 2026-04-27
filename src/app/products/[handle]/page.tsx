import ProductDetail from "@/components/ProductDetail";
import { getProductByHandle } from "@/lib/products-server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
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
  const product = await getProductByHandle(handle);
  if (!product || product.disabled) notFound();
  return <ProductDetail product={product} />;
}
