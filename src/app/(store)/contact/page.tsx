import ContactForm from "@/components/ContactForm";
import RegionGate from "@/components/RegionGate";
import Link from "next/link";
import { InstagramIcon } from "@/components/Socials";
import { Card } from "@/components/ui";

export const metadata = { title: "Contact — Abandoned Alley" };

export default function ContactPage() {
  return (
    <RegionGate>
      <div className="aa-container" style={{ padding: "var(--space-16) var(--space-6)" }}>
        <div style={{ marginBottom: "var(--space-10)" }}>
          <div className="aa-eyebrow">CAIRO — NEW YORK</div>
          <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-2)" }}>
            CONTACT
          </h1>
          <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
            Orders, sizing, wholesale, or press. Write to us directly — a person answers.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--space-16)", alignItems: "start" }} className="aa-product-grid">
          <ContactForm />

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Card>
              <div className="aa-eyebrow" style={{ marginBottom: "var(--space-3)" }}>DIRECT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <a href="mailto:hello@abandonedalley.com" className="aa-body">hello@abandonedalley.com</a>
                <a href="mailto:wholesale@abandonedalley.com" className="aa-body">wholesale@abandonedalley.com</a>
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
            </Card>

            <Card>
              <div className="aa-eyebrow" style={{ marginBottom: "var(--space-3)" }}>STUDIO</div>
              <p className="aa-body">Downtown Cairo. Visits by appointment only — message first.</p>
              <p className="aa-caption" style={{ marginTop: "var(--space-2)" }}>SUN–THU · 12:00–20:00 EET</p>
            </Card>

            <div style={{ background: "var(--graphic-yellow)", padding: "var(--space-6)" }}>
              <div className="aa-eyebrow" style={{ color: "#5a4a12", marginBottom: "var(--space-3)" }}>SHIPPING</div>
              <p className="aa-body" style={{ color: "#3a3524" }}>
                We currently ship within Egypt — Cairo &amp; Giza get the metro rate, other
                governorates get the standard rate. Free returns within 14 days.
              </p>
              <Link
                href="/region"
                className="aa-nav-link"
                style={{ display: "inline-block", marginTop: "var(--space-3)", color: "var(--accent-active)" }}
              >
                SWITCH REGION →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </RegionGate>
  );
}
