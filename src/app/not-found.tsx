import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">Lost in the void</p>
      <h1 className="font-[family-name:var(--font-bebas)] text-7xl md:text-9xl tracking-[0.1em]">
        404
      </h1>
      <p className="text-white/60 max-w-sm">
        That page got struck by lightning. Try heading home.
      </p>
      <Link
        href="/"
        className="mt-4 px-6 py-3 border border-white/40 hover:border-white rounded-lg uppercase tracking-[0.2em] text-sm transition"
      >
        Back home
      </Link>
    </div>
  );
}
