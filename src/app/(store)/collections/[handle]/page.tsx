import ProductGrid from "@/components/ProductGrid";
import { getCollectionByHandle } from "@/lib/collections-server";
import { getActiveProducts } from "@/lib/products-server";
import Image from "next/image";
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
        <div
          style={{
            position: "relative",
            // `width: 100%` is load-bearing, not decorative. With `aspect-ratio`
            // and an auto width, `min-height` makes the browser derive the WIDTH
            // back from the height: on a 375px phone the ratio wanted a 122px-tall
            // box, min-height forced 240px, and the box resolved to 240 * 16/6 =
            // 640px — overflowing the 327px content column, pushing the document
            // to 664px and squashing the whole page. Pinning the width keeps the
            // ratio driving the height and never the reverse.
            width: "100%",
            aspectRatio: "16 / 6",
            minHeight: 240,
            border: "1px solid var(--border-default)",
            marginBottom: "var(--space-12)",
            background: "var(--surface-card-alt)",
            overflow: "hidden",
          }}
        >
          {meta.image && (
            <Image src={meta.image} alt={meta.title} fill sizes="100vw" style={{ objectFit: "cover" }} unoptimized />
          )}
        </div>
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
