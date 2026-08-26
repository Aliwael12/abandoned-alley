import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        textAlign: "center",
        padding: "0 var(--space-6)",
      }}
    >
      <div className="aa-eyebrow">LOST THE THREAD</div>
      <h1 className="aa-display-hero" style={{ fontSize: "var(--text-6xl)" }}>404</h1>
      <p className="aa-body" style={{ color: "var(--text-muted)", maxWidth: 360 }}>
        That page doesn&apos;t exist. Try heading home.
      </p>
      <Link href="/">
        <Button variant="secondary" size="md" style={{ marginTop: "var(--space-2)" }}>
          BACK HOME
        </Button>
      </Link>
    </div>
  );
}
