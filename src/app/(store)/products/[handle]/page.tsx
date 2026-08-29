import ProductDetail from "@/components/ProductDetail";
import RegionGate from "@/components/RegionGate";
import { getActiveProducts, getProductByHandle } from "@/lib/products-server";
import { getSizeChartByHandle } from "@/lib/size-charts-server";
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
  const [sizeChart, allProducts] = await Promise.all([
    product.sizeChartId ? getSizeChartByHandle(product.sizeChartId) : Promise.resolve(null),
    getActiveProducts(),
  ]);
  const related = allProducts.filter((p) => p.handle !== product.handle).slice(0, 3);
  return (
    <RegionGate>
      <ProductDetail product={product} sizeChart={sizeChart} related={related} />
    </RegionGate>
  );
}
