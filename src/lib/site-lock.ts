import { CAIRO_TIME_ZONE as TIME_ZONE, zonedTimeToUtc } from "@/lib/cairo-time";

// August 26, 2026, 12:00 PM Cairo time.
export const SITE_UNLOCK_AT = zonedTimeToUtc("2026-08-26T12:00:00", TIME_ZONE);

export function isSiteLocked(now: number = Date.now()): boolean {
  return now < SITE_UNLOCK_AT;
}
