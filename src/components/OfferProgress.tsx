"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Truck } from "lucide-react";
import { OFFER_COPY, offerGaps, offerTier, type OfferConfig } from "@/lib/offer";

/**
 * The spend-offer progress bar for the cart drawer and /cart: 0 → the discount
 * threshold, with a small truck tick at free delivery and a bold badge at the
 * discount. The text above it always gives the gap in money, never the rule,
 * and leads with the discount. Reaching the top tier gets a short flash.
 */
export default function OfferProgress({ offer, subtotal }: { offer: OfferConfig; subtotal: number }) {
  const reduceMotion = useReducedMotion();
  const tier = offerTier(offer, subtotal);
  const { toFreeDelivery, toDiscount } = offerGaps(offer, subtotal);
  const fill = Math.min(1, Math.max(0, subtotal / offer.discountAt));
  const tickAt = (offer.freeDeliveryAt / offer.discountAt) * 100;
  const full = tier === "discount";

  return (
    <div className="aa-offer-progress">
      <p className="aa-offer-progress-main">
        {full ? OFFER_COPY.allUnlocked(offer) : OFFER_COPY.awayFromDiscount(toDiscount, offer)}
      </p>
      {!full && (
        <p className="aa-caption">
          {tier === "free_delivery" ? OFFER_COPY.freeDeliveryUnlocked : OFFER_COPY.toFreeDelivery(toFreeDelivery)}
        </p>
      )}

      {/* Keyed on the tier, so crossing into the top tier remounts the bar and
          plays the flash once (under a second). */}
      <motion.div
        key={full ? "full" : "filling"}
        className="aa-offer-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={offer.discountAt}
        aria-valuenow={Math.min(subtotal, offer.discountAt)}
        aria-label="Progress toward the spend offer"
        initial={full && !reduceMotion ? { scale: 1.04, filter: "brightness(1.5)" } : false}
        animate={{ scale: 1, filter: "brightness(1)" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="aa-offer-progress-rail">
          <div className="aa-offer-progress-track">
            <div className="aa-offer-progress-fill" style={{ width: `${fill * 100}%` }} />
          </div>
          <span
            className={`aa-offer-progress-tick${tier !== "none" ? " is-reached" : ""}`}
            style={{ left: `${tickAt}%` }}
            title="Free delivery"
          >
            {tier !== "none" ? <Check size={11} aria-hidden /> : <Truck size={11} aria-hidden />}
          </span>
        </div>
        <span className={`aa-offer-progress-badge${full ? " is-reached" : ""}`}>
          {OFFER_COPY.discountBadge(offer)}
        </span>
      </motion.div>
    </div>
  );
}
