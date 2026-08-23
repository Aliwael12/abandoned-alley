const TIME_ZONE = "Africa/Cairo";

/**
 * Converts a local wall-clock time in `timeZone` to a UTC epoch (ms) via the
 * standard double-conversion trick (no date library / DST table available at
 * this layer).
 */
function zonedTimeToUtc(isoLocal: string, timeZone: string): number {
  const guessUtc = new Date(`${isoLocal}Z`).getTime();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guessUtc));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const asIfUtcInZone = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second"))
  );

  return guessUtc - (asIfUtcInZone - guessUtc);
}

// August 25, 2026, 12:00 PM Cairo time.
export const SITE_UNLOCK_AT = zonedTimeToUtc("2026-08-25T12:00:00", TIME_ZONE);

export function isSiteLocked(now: number = Date.now()): boolean {
  return now < SITE_UNLOCK_AT;
}
