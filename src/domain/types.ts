/**
 * Shared domain value types. Pure TypeScript only — no Electron, DOM, React or
 * persistence imports belong in this module or anywhere under src/domain.
 */

export type Id = string;

/** Validated Gregorian calendar date, "YYYY-MM-DD". */
export type LocalDate = string & { readonly __brand: "LocalDate" };

/** Minutes after local midnight, 0-1439. */
export type LocalTime = number & { readonly __brand: "LocalTime" };

/** UTC ISO-8601 instant, e.g. "2026-09-05T07:00:00.000Z". */
export type Instant = string & { readonly __brand: "Instant" };

/** ISO weekday, 1 (Monday) - 7 (Sunday). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Provenance = "manual" | "demo" | "imported";

export type Role = "HCA" | "LPN";

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function toLocalDate(value: string): LocalDate {
  if (!isValidLocalDate(value)) {
    throw new Error(`Invalid LocalDate: "${value}"`);
  }
  return value as LocalDate;
}

export function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const yyyy = next.getUTCFullYear().toString().padStart(4, "0");
  const mm = (next.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = next.getUTCDate().toString().padStart(2, "0");
  return toLocalDate(`${yyyy}-${mm}-${dd}`);
}

/** ISO weekday (1=Mon..7=Sun) for a LocalDate, computed calendar-only (no timezone). */
export function isoWeekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay === 0 ? 7 : jsDay) as Weekday;
}

export function dayOfMonthOf(date: LocalDate): number {
  return Number(date.split("-")[2]);
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  const aUtc = Date.UTC(ay, am - 1, ad);
  const bUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((bUtc - aUtc) / 86_400_000);
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const HHMM_RE = /^([01]\d|2[0-3])([0-5]\d)$/;

/** Parses a validated "HHmm" military-time string (e.g. "0700", "2359") into minutes-after-midnight. */
export function parseHHmm(value: string): LocalTime {
  const match = HHMM_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid HHmm time: "${value}"`);
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  return (hh * 60 + mm) as LocalTime;
}

export function formatHHmm(minutes: LocalTime): string {
  if (minutes < 0 || minutes > 1439 || !Number.isInteger(minutes)) {
    throw new Error(`Invalid LocalTime minutes: ${minutes}`);
  }
  const hh = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mm = (minutes % 60).toString().padStart(2, "0");
  return `${hh}${mm}`;
}

export function toLocalTime(minutes: number): LocalTime {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    throw new Error(`Invalid LocalTime minutes: ${minutes}`);
  }
  return minutes as LocalTime;
}
