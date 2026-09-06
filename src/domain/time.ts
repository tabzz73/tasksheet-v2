/**
 * Facility-local <-> UTC instant conversion and the canonical shift-window
 * algorithm from ARCHITECTURE-ESSENTIALS.md §6.
 *
 * DST gap/fold precision (DATA-CONTRACTS.md §2, AC-08): a scheduled local
 * time inside a spring-forward gap (the wall-clock value never occurs) is
 * moved forward by the gap duration; a wall-clock value that occurs twice
 * during a fall-back fold resolves to the earlier of the two real instants,
 * exactly once. `resolveLocalDateTime` below implements this via the
 * standard two-offset trial-and-disambiguation technique: guess an offset,
 * derive a candidate instant, re-check the offset actually in effect at
 * that candidate, and compare each candidate's real local rendition back
 * against the requested wall time to classify normal / gap / fold.
 */
import { addDaysToLocalDate, type Instant, type LocalDate, type LocalTime } from "./types.js";

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function timeZoneOffsetMinutes(timeZone: string, instant: Date): number {
  const wall = wallTimeAt(timeZone, instant);
  const asIfUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  return (asIfUtc - instant.getTime()) / 60_000;
}

function wallTimeAt(timeZone: string, instant: Date): WallTime {
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
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

function sameWallTime(a: WallTime, b: WallTime): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

export interface LocalDateTimeResolution {
  instant: Instant;
  /** True when the requested wall-clock time fell inside a DST spring-forward
   * gap and had to be moved forward by the gap duration (DATA-CONTRACTS.md §2). */
  gapAdjusted: boolean;
  /** True when the requested wall-clock time occurred twice (DST fall-back fold)
   * and the earlier of the two real instants was chosen. */
  foldResolved: boolean;
}

/**
 * Resolves a facility-local calendar date + minutes-after-midnight to a UTC
 * instant, disambiguating DST gaps and folds per DATA-CONTRACTS.md §2. The
 * requested wall-clock values themselves are never altered by this function
 * (callers preserve the original local slot as occurrence identity); only
 * the resolved instant accounts for the gap/fold.
 */
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function resolveLocalDateTime(date: LocalDate, minutes: LocalTime, timeZone: string): LocalDateTimeResolution {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const target: WallTime = { year: y, month: m, day: d, hour: hh, minute: mm };
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  // First pass: naive single-offset guess. This alone is exact away from a
  // transition, and lands close enough to the true instant near one (off by
  // at most the DST delta, typically an hour) to anchor the bracket below.
  const o1 = timeZoneOffsetMinutes(timeZone, new Date(naiveUtcMs));
  const anchorMs = naiveUtcMs - o1 * 60_000;

  // Sample the real offset well before and after the anchor. No DST
  // transition shifts the clock by anywhere near 2 hours, so if a transition
  // is in play near this wall time, these two samples are guaranteed to fall
  // on opposite sides of it; if not, they agree and confirm the normal case.
  const offsetBefore = timeZoneOffsetMinutes(timeZone, new Date(anchorMs - TWO_HOURS_MS));
  const offsetAfter = timeZoneOffsetMinutes(timeZone, new Date(anchorMs + TWO_HOURS_MS));

  if (offsetBefore === offsetAfter) {
    // No DST transition anywhere near this wall time — the ordinary case.
    // Re-derive with the offset actually in effect at the anchor, for exactness.
    const o2 = timeZoneOffsetMinutes(timeZone, new Date(anchorMs));
    return { instant: new Date(naiveUtcMs - o2 * 60_000).toISOString() as Instant, gapAdjusted: false, foldResolved: false };
  }

  const candidateBeforeMs = naiveUtcMs - offsetBefore * 60_000;
  const candidateAfterMs = naiveUtcMs - offsetAfter * 60_000;
  const matchesBefore = sameWallTime(wallTimeAt(timeZone, new Date(candidateBeforeMs)), target);
  const matchesAfter = sameWallTime(wallTimeAt(timeZone, new Date(candidateAfterMs)), target);

  if (matchesBefore && matchesAfter) {
    // Fall-back fold: this wall time is real twice. Resolve to the earlier instant once.
    const earlierMs = Math.min(candidateBeforeMs, candidateAfterMs);
    return { instant: new Date(earlierMs).toISOString() as Instant, gapAdjusted: false, foldResolved: true };
  }
  if (matchesBefore) {
    return { instant: new Date(candidateBeforeMs).toISOString() as Instant, gapAdjusted: false, foldResolved: false };
  }
  if (matchesAfter) {
    return { instant: new Date(candidateAfterMs).toISOString() as Instant, gapAdjusted: false, foldResolved: false };
  }

  // Spring-forward gap: this wall time never occurs. Using the pre-transition
  // offset lands past the transition and re-renders under the post-transition
  // offset as the requested time moved forward by exactly the gap duration —
  // the documented policy.
  return { instant: new Date(candidateBeforeMs).toISOString() as Instant, gapAdjusted: true, foldResolved: false };
}

/** Converts a facility-local calendar date + minutes-after-midnight to a UTC instant. */
export function localDateTimeToInstant(
  date: LocalDate,
  minutes: LocalTime,
  timeZone: string
): Instant {
  return resolveLocalDateTime(date, minutes, timeZone).instant;
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
