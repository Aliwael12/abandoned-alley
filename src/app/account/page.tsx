import Link from "next/link";

export const metadata = { title: "Account — Abandoned Alley" };

export default function AccountPage() {
  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <div className="glass rounded-2xl p-8 flex flex-col gap-5">
        <div className="text-center flex flex-col gap-2">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/50">Members</p>
          <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-[0.18em] uppercase">
            Sign in
          </h2>
        </div>

        <form className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            className="bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition"
          />
          <input
            type="password"
            placeholder="Password"
            className="bg-white/5 border border-white/15 rounded-md h-12 px-4 outline-none focus:border-white/40 transition"
          />
          <button
            type="button"
            className="h-12 bg-white text-black rounded-md font-[family-name:var(--font-bebas)] tracking-[0.25em] uppercase mt-2 hover:bg-white/90 transition"
          >
            Continue
          </button>
        </form>

        <div className="text-center text-xs text-white/50">
          New here? <Link href="#" className="text-white">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
