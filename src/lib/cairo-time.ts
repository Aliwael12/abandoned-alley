// Cairo wall-clock time <-> UTC epoch, without a date library or DST table:
// Intl knows the zone's offset at any instant, which is all these need.

export const CAIRO_TIME_ZONE = "Africa/Cairo";

function wallParts(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Converts a local wall-clock time ("2026-08-26T12:00" or with seconds) in
 * `timeZone` to a UTC epoch (ms) via the standard double-conversion trick.
 */
export function zonedTimeToUtc(isoLocal: string, timeZone: string = CAIRO_TIME_ZONE): number {
  const guessUtc = new Date(`${isoLocal.length === 16 ? `${isoLocal}:00` : isoLocal}Z`).getTime();
  const p = wallParts(guessUtc, timeZone);
  const asIfUtcInZone = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return guessUtc - (asIfUtcInZone - guessUtc);
}

/** A UTC epoch as `timeZone` wall-clock time, in datetime-local format ("YYYY-MM-DDTHH:mm"). */
export function utcToZonedInput(utcMs: number, timeZone: string = CAIRO_TIME_ZONE): string {
  const p = wallParts(utcMs, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
