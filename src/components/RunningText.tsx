const PHRASES = ["ABANDONED ALLEY", "DON'T DIE WONDERING"];

export default function RunningText() {
  // Build a reasonably long sequence so the loop feels seamless
  const sequence = Array.from({ length: 14 }, (_, i) => PHRASES[i % PHRASES.length]);

  return (
    <div className="relative z-30 border-y border-white/10 bg-black/40 backdrop-blur-md py-2 overflow-hidden">
      <div className="marquee-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0">
            {sequence.map((phrase, i) => (
              <span
                key={i}
                className="px-6 text-[11px] tracking-[0.25em] text-white/80 uppercase font-[family-name:var(--font-bebas)] flex items-center gap-6"
              >
                {phrase}
                <span className="text-white/30">|</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
