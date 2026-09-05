/**
 * Facility-local <-> UTC instant conversion and the canonical shift-window
 * algorithm from ARCHITECTURE-ESSENTIALS.md §6.
 *
 * Known limitation (documented, not silently assumed correct): this uses a
 * single-iteration Intl.DateTimeFormat offset lookup, which is exact for all
 * non-DST-transition instants but does not yet implement the documented
 * DST gap/fold "resolve to the earlier instant once" policy from
 * DATA-CONTRACTS.md §2. Precise DST gap/fold handling is deferred to phase 2
 * (AC-08) and must not be claimed as implemented until covered by the
 * required real spring-forward/fall-back fixtures.
 */
import { addDaysToLocalDate, type Instant, type LocalDate, type LocalTime } from "./types.js";

function timeZoneOffsetMinutes(timeZone: string, utcGuess: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = dtf.formatToParts(utcGuess);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asIfUtc - utcGuess.getTime()) / 60_000;
}

/** Converts a facility-local calendar date + minutes-after-midnight to a UTC instant. */
export function localDateTimeToInstant(
  date: LocalDate,
  minutes: LocalTime,
  timeZone: string
): Instant {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offsetMinutes = timeZoneOffsetMinutes(timeZone, utcGuess);
  const actual = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  return actual.toISOString() as Instant;
}

export interface ShiftTimeSpec {
  startMinutes: LocalTime;
  endMinutes: LocalTime;
}

export interface ShiftWindow {
  start: Instant;
  end: Instant;
  isOvernight: boolean;
  /** The calendar date after the shift, only meaningful when isOvernight. */
  endDate: LocalDate;
}

/**
 * Canonical shift-window algorithm (ARCHITECTURE-ESSENTIALS.md §6):
 * endMinutes <= startMinutes means overnight; end falls on D+1.
 * Comparisons use the half-open range [start, end).
 */
export function computeShiftWindow(
  shift: ShiftTimeSpec,
  date: LocalDate,
  timeZone: string
): ShiftWindow {
  const isOvernight = shift.endMinutes <= shift.startMinutes;
  const start = localDateTimeToInstant(date, shift.startMinutes, timeZone);
  const endDate = isOvernight ? addDaysToLocalDate(date, 1) : date;
  const end = localDateTimeToInstant(endDate, shift.endMinutes, timeZone);
  return { start, end, isOvernight, endDate };
}

/** Half-open [start, end) inclusion test used for all occurrence eligibility. */
export function instantInWindow(instant: Instant, window: ShiftWindow): boolean {
  return instant >= window.start && instant < window.end;
}
