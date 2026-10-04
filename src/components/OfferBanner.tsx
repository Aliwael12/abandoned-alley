"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CAIRO_TIME_ZONE } from "@/lib/cairo-time";
import { OFFER_COPY } from "@/lib/offer";
import { useLiveOffer } from "@/lib/use-offer";

/**
 * The spend-offer announcement bar, at the very top of every store page while
 * the offer runs (Egypt only). Always one line: when the text doesn't fit —
 * on phones — it scrolls sideways as a marquee instead of wrapping.
 */
export default function OfferBanner() {
  const offer = useLiveOffer();
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  const endsLabel = offer?.endsAt
    ? new Date(offer.endsAt - 1)
        .toLocaleDateString("en-GB", { timeZone: CAIRO_TIME_ZONE, day: "numeric", month: "short" })
        .toUpperCase()
    : null;
  const text = offer ? OFFER_COPY.banner(offer, endsLabel) : "";

  // Measure the single copy of the text against the bar whenever the bar
  // resizes (rotation, window resize). A ResizeObserver also reports once as
  // soon as it starts observing, which covers the first measurement.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = textRef.current;
    if (!box || !span) return;
    const measure = () => setOverflows(span.scrollWidth > box.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);

  if (!offer) return null;

  return (
    <div
      ref={boxRef}
      className={`aa-offer-banner${overflows ? " aa-offer-banner--marquee" : ""}`}
      role="region"
      aria-label="Current offer"
    >
      <div className="aa-offer-banner-track">
        <span ref={textRef}>{text}</span>
        {/* The marquee loops two copies; the second is decoration only. */}
        {overflows && <span aria-hidden="true">{text}</span>}
      </div>
    </div>
  );
}
