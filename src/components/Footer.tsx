import Image from "next/image";
import Link from "next/link";
import { InstagramIcon } from "./Socials";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-default)",
        padding: "var(--space-16) var(--space-6) var(--space-10)",
      }}
    >
      <div
        className="aa-footer-grid"
        style={{
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr",
          gap: "var(--space-12)",
        }}
      >
        <div>
          <Image
            src="/brand/logo-solid-black.png"
            alt="Abandoned Alley"
            width={32}
            height={32}
            style={{ objectFit: "contain", marginBottom: "var(--space-4)" }}
          />
          <p className="aa-body" style={{ color: "var(--text-muted)", maxWidth: 320 }}>
            Egyptian streetwear, made in Cairo, worn everywhere. Don&apos;t die wondering.
          </p>
        </div>

        <div>
          <div className="aa-eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            SHOP
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Link href="/shop" className="aa-body">All products</Link>
            <Link href="/cart" className="aa-body">Bag</Link>
            <Link href="/region" className="aa-body">Switch region</Link>
          </div>
        </div>

        <div>
          <div className="aa-eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            CONTACT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <a href="mailto:hello@abandonedalley.com" className="aa-body">
              hello@abandonedalley.com
            </a>
            <a
              href="https://www.instagram.com/aa.collectives/"
              target="_blank"
              rel="noopener noreferrer"
              className="aa-body"
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
            >
              <InstagramIcon size={16} /> @aa.collectives
            </a>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "var(--container-max)",
          margin: "var(--space-12) auto 0",
          paddingTop: "var(--space-6)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <span className="aa-caption">© 2026 ABANDONED ALLEY</span>
        <span className="aa-caption">CAIRO — NEW YORK</span>
      </div>
    </footer>
  );
}
