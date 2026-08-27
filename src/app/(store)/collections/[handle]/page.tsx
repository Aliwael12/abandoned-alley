import ProductCard from "@/components/ProductCard";
import { getCollectionByHandle } from "@/lib/collections-server";
import { getActiveProducts } from "@/lib/products-server";
import Image from "next/image";
import { notFound } from "next/navigation";

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
      <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
        <div
          style={{
            position: "relative",
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

        {items.length === 0 ? (
          <p className="aa-body" style={{ color: "var(--text-muted)", textAlign: "center" }}>
            No items in this collection yet.
          </p>
        ) : (
          <div className="aa-grid">
            {items.map((p) => (
              <div key={p.handle} style={{ gridColumn: "span 4" }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
