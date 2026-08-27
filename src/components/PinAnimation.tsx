type Pin = {
  src: string;
  left: number;
  top: number;
  vw: number;
  px: number;
  fx: number;
  fy: number;
  fr: number;
  rot: number;
  delay: number;
  /** Kept (shrunk) on narrow screens; the rest are hidden there. */
  corner?: boolean;
};

// Positions/timings/values verbatim from the design handoff
// (design_handoff_pin_animation/README.md). Deliberately avoids the center
// column (logo, nav, date, handle) on the home screen — keep the middle
// ~30-70% horizontal band clear if pins are ever added or repositioned.
const PINS: Pin[] = [
  { src: "/media/pins-bg/pin-bg-getfly.png", left: 4, top: 9, vw: 9.5, px: 96, fx: -60, fy: -18, fr: -160, rot: -13, delay: 0, corner: true },
  { src: "/media/pins-bg/pin-bg-cola.png", left: 78, top: 8, vw: 9, px: 94, fx: 52, fy: -22, fr: 200, rot: 12, delay: 0.7, corner: true },
  { src: "/media/pins-bg/pin-bg-idgaf.png", left: 22, top: 27, vw: 7, px: 76, fx: -50, fy: 26, fr: 190, rot: 8, delay: 1.4 },
  { src: "/media/pins-bg/pin-bg-i-love-aa.png", left: 88, top: 34, vw: 8, px: 86, fx: 48, fy: 6, fr: -180, rot: -17, delay: 2.1 },
  { src: "/media/pins-bg/pin-bg-earth.png", left: 9, top: 63, vw: 8.5, px: 90, fx: -46, fy: 34, fr: -220, rot: 19, delay: 2.8 },
  { src: "/media/pins-bg/pin-bg-smile.png", left: 81, top: 58, vw: 7.5, px: 82, fx: 44, fy: 30, fr: 170, rot: 6, delay: 3.5 },
  { src: "/media/pins-bg/pin-bg-ddw-blue.png", left: 20, top: 84, vw: 7, px: 78, fx: -20, fy: 46, fr: 150, rot: -21, delay: 4.2, corner: true },
  { src: "/media/pins-bg/pin-bg-ddw-video.png", left: 90, top: 82, vw: 7, px: 78, fx: 26, fy: 44, fr: -140, rot: -26, delay: 4.9, corner: true },
  { src: "/media/pins-bg/pin-bg-bad-bitch.png", left: 45, top: 4, vw: 6.5, px: 72, fx: 4, fy: -34, fr: 210, rot: 15, delay: 5.6 },
];

/**
 * Enamel pins fly in from off-screen, land on the page with a bounce, hold,
 * then lift off and repeat — a continuous "pins being added to the page"
 * loop. Fixed + pointer-events:none so it never intercepts clicks and reads
 * as a background across every page, not just the one it's mounted highest
 * on. Remount (change React `key`) to restart the whole loop from zero.
 */
export default function PinAnimation() {
  return (
    <div className="aa-pin-layer" aria-hidden>
      {PINS.map((p, i) => (
        // Decorative, freely positioned/animated via custom CSS transforms —
        // next/image's wrapper div fights that rather than helping.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={p.src}
          alt=""
          className={p.corner ? "aa-pin aa-pin--corner" : "aa-pin"}
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `max(${p.vw}vw, ${p.px}px)`,
              animationDelay: `${p.delay}s`,
              "--fx": `${p.fx}vw`,
              "--fy": `${p.fy}vh`,
              "--fr": `${p.fr}deg`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
