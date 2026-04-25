"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <footer className="relative z-10 border-t border-white/10 mt-24 bg-black/40 backdrop-blur-md">
      <div className="max-w-[1100px] mx-auto px-6 py-12 flex flex-col items-center gap-6">
        <h5 className="font-[family-name:var(--font-bebas)] tracking-[0.2em] text-xl">
          Subscribe to our email
        </h5>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) setDone(true);
          }}
          className="neon-glass h-12 flex items-center w-full max-w-md overflow-hidden"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 bg-transparent border-none px-5 h-full outline-none text-white placeholder:text-white/50"
          />
          <button
            type="submit"
            aria-label="Subscribe"
            className="px-5 h-full flex items-center text-white hover:text-[var(--accent)] transition"
          >
            <ArrowRight size={20} />
          </button>
        </form>
        {done && (
          <p className="text-xs text-white/60">Thanks — you&apos;re on the list.</p>
        )}

        <p className="text-[11px] tracking-[0.3em] uppercase text-white/40 mt-4">
          &copy; 2026 Abandoned Alley
        </p>
      </div>
    </footer>
  );
}
