"use client";

import { useEffect, useState } from "react";

export default function PageLoader() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`page-loader ${active ? "active" : ""}`} aria-hidden>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="font-[family-name:var(--font-bebas)] tracking-[0.3em] text-white/70 text-sm">
          ABANDONED ALLEY
        </p>
      </div>
    </div>
  );
}
