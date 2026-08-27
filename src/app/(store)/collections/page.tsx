import { getAllCollections } from "@/lib/collections-server";
import { getActiveProducts } from "@/lib/products-server";
import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Collections — Abandoned Alley" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const [collections, products] = await Promise.all([
    getAllCollections(),
    getActiveProducts(),
  ]);

  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.collection, (counts.get(p.collection) ?? 0) + 1);
  }

  return (
      <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
        <div style={{ marginBottom: "var(--space-10)" }}>
          <div className="aa-eyebrow">DROP 004 — FIVE WAYS IN</div>
          <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-2)" }}>
            COLLECTIONS
          </h1>
          <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            Pick a category. Every piece runs once — when a size goes, it goes.
          </p>
        </div>

        {collections.length === 0 ? (
          <p className="aa-body" style={{ color: "var(--text-muted)", textAlign: "center" }}>
            No collections yet.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-6)",
            }}
          >
            {collections.map((c) => {
              const count = counts.get(c.handle) ?? 0;
              return (
                <Link
                  key={c.handle}
                  href={`/collections/${c.handle}`}
                  className="aa-card--interactive"
                  style={{
                    display: "block",
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-card)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "4 / 5",
                      background: "var(--surface-card-alt)",
                    }}
                  >
                    {c.image && (
                      <Image
                        src={c.image}
                        alt={c.title}
                        fill
                        sizes="(min-width:1024px) 20vw, (min-width:640px) 33vw, 50vw"
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                    )}
                  </div>
                  <div style={{ padding: "var(--space-4) var(--space-5)" }}>
                    <h3 className="aa-display-h3">{c.title}</h3>
                    <p className="aa-caption" style={{ marginTop: "var(--space-1)" }}>
                      {count} {count === 1 ? "PIECE" : "PIECES"}
                    </p>
                    {c.description && (
                      <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                        {c.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
  );
}
