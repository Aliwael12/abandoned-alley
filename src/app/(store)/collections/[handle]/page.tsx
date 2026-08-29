import ProductGrid from "@/components/ProductGrid";
import { getCollectionByHandle } from "@/lib/collections-server";
import { getActiveProducts } from "@/lib/products-server";
import { notFound } from "next/navigation";
import RegionGate from "@/components/RegionGate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const c = await getCollectionByHandle(handle);
  return {
    title: c ? `${c.title} — Abandoned Alley` : "Collection — Abandoned Alley",
  };
}

export default async function CollectionDetail({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const meta = await getCollectionByHandle(handle);
  if (!meta) notFound();
  const all = await getActiveProducts();
  const items = all.filter((p) => p.collection === handle);

  return (
    <RegionGate>
      <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
        {/* No hero banner: the collection artwork is portrait (0.67-1.14) while
            a banner box is wide (2.67 on desktop), so `cover` cropped the subject
            out and `contain` left the box mostly empty. The images still appear,
            correctly, on the /collections index, whose cards are 4/5 portrait. */}
        <div style={{ marginBottom: "var(--space-10)" }}>
          <div className="aa-eyebrow">COLLECTION</div>
          <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-2)" }}>
            {meta.title}
          </h1>
          <p className="aa-caption" style={{ marginTop: "var(--space-2)" }}>
            {items.length} {items.length === 1 ? "PIECE" : "PIECES"}
          </p>
        </div>

        <ProductGrid products={items} emptyMessage="No items in this collection yet." />
      </div>
    </RegionGate>
  );
}
