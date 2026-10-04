"use client";

import { Fragment } from "react";
import { CAIRO_TIME_ZONE } from "@/lib/cairo-time";
import { OFFER_COPY } from "@/lib/offer";
import { useLiveOffer } from "@/lib/use-offer";
import { PIN_IMAGES } from "./PinAnimation";

/** Copies of the message set in each half of the loop: enough to run wider
 * than any screen, so the strip never shows a gap. */
const COPIES_PER_HALF = 4;

/**
 * The spend-offer announcement strip, at the very top of every store page while
 * the offer runs (Egypt only). It scrolls continuously, with one of the
 * background animation's pins between each message. The track holds two
 * identical halves and slides by exactly one half, so the loop is seamless.
 * With reduced motion it stands still.
 */
export default function OfferBanner() {
  const offer = useLiveOffer();
  if (!offer) return null;

  const endsLabel = offer.endsAt
    ? new Date(offer.endsAt - 1)
        .toLocaleDateString("en-GB", { timeZone: CAIRO_TIME_ZONE, day: "numeric", month: "short" })
        .toUpperCase()
    : null;
  const items = OFFER_COPY.bannerItems(offer, endsLabel);

  // One long run of messages, each followed by the next pin in the set.
  const run = Array.from({ length: COPIES_PER_HALF }, () => items).flat();
  const half = (keyPrefix: string) =>
    run.map((text, i) => (
      <Fragment key={`${keyPrefix}-${i}`}>
        <span className="aa-offer-strip-item">{text}</span>
        {/* Decorative; the pins are the same files the background animation
            already loaded. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PIN_IMAGES[i % PIN_IMAGES.length]}
          alt=""
          className="aa-offer-strip-pin"
          style={{ rotate: `${i % 2 ? 12 : -12}deg` }}
        />
      </Fragment>
    ));

  return (
    <div className="aa-offer-strip" role="region" aria-label="Current offer">
      {/* Screen readers get the messages once, not the scrolling copies. */}
      <span className="sr-only">{items.join(". ")}</span>
      <div className="aa-offer-strip-track" aria-hidden="true">
        {half("a")}
        {half("b")}
      </div>
    </div>
  );
}
