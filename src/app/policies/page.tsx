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
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex flex-col items-center gap-3 mb-10">
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">
          Legal
        </p>
        <h2 className="font-[family-name:var(--font-bebas)] text-4xl md:text-5xl tracking-[0.18em] uppercase">
          Terms & Policies
        </h2>
        <div className="w-12 h-px bg-white/30" />
      </div>

      <div className="flex flex-col gap-7">
        {sections.map((s) => (
          <section key={s.title} className="glass rounded-xl p-6">
            <h3 className="font-[family-name:var(--font-bebas)] text-2xl tracking-[0.16em] mb-2">
              {s.title}
            </h3>
            <p className="text-white/70 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
