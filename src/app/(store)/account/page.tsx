import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";

export const metadata = { title: "Account — Abandoned Alley" };

export default function AccountPage() {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-16) var(--space-6)" }}>
      <Card>
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <div className="aa-eyebrow">MEMBERS</div>
          <h1 className="aa-display-h1" style={{ marginTop: "var(--space-2)" }}>SIGN IN</h1>
        </div>

        <form style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input type="email" placeholder="Email" />
          <Input type="password" placeholder="Password" />
          <Button type="button" variant="primary" size="lg" style={{ marginTop: "var(--space-2)" }}>
            CONTINUE
          </Button>
        </form>

        <p className="aa-caption" style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
          New here? <Link href="/shop" style={{ color: "var(--text-primary)" }}>Start shopping</Link>
        </p>
      </Card>
    </div>
  );
}
