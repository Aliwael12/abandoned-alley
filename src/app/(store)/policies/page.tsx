import { Card } from "@/components/ui";

export const metadata = { title: "Terms & Policies — Abandoned Alley" };

const sections = [
  {
    title: "Privacy",
    body: "We collect the minimum required to fulfill orders and improve the shop — order info, shipping address, and the analytics necessary to keep the site running. We never sell your data.",
  },
  {
    title: "Shipping",
    body: "We currently deliver within Egypt only. Orders to Cairo and Giza are dispatched right away; other governorates take an estimated 3-5 business days. Shipping is calculated at checkout based on your governorate.",
  },
  {
    title: "Returns",
    body: "14-day window from delivery. Items must be unworn, unwashed, and tagged. Sale items are final. Email studio@abandonedalley.example to start a return.",
  },
  {
    title: "Terms of service",
    body: "By using this site you agree to use it lawfully. Prices and availability subject to change. All artwork & product imagery is property of Abandoned Alley.",
  },
];

export default function PoliciesPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "var(--space-16) var(--space-6)" }}>
      <div style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
        <div className="aa-eyebrow">LEGAL</div>
        <h1 className="aa-display-hero" style={{ fontSize: "var(--text-4xl)", marginTop: "var(--space-2)" }}>
          TERMS &amp; POLICIES
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {sections.map((s) => (
          <Card key={s.title}>
            <h2 className="aa-display-h3" style={{ marginBottom: "var(--space-3)" }}>{s.title}</h2>
            <p className="aa-body" style={{ color: "var(--text-muted)" }}>{s.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
