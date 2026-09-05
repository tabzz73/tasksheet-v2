/**
 * Cadence/placement schedule types and pure cadence-matching, per
 * DATA-CONTRACTS.md §2. Placement "period" and "date_only" require a
 * configured shift/period mapping that is out of scope for the phase-1
 * first workflow; cadenceMatches/placement helpers here are honest about
 * that rather than silently approximating it.
 */
import {
  compareLocalDate,
  dayOfMonthOf,
  daysBetween,
  isoWeekdayOf,
  type LocalDate,
  type LocalTime,
  type Weekday
} from "./types.js";

export type Cadence =
  | { kind: "daily" }
  | { kind: "weekdays"; days: readonly Weekday[] }
  | { kind: "interval"; everyDays: number; anchorDate: LocalDate }
  | { kind: "month_days"; days: readonly number[] }
  | { kind: "one_time"; date: LocalDate };

export type Placement =
  | { kind: "times"; minutes: readonly LocalTime[] }
  | { kind: "period"; period: "DAY" | "EVENING" | "NIGHT" }
  | { kind: "date_only" };

export interface Schedule {
  cadence: Cadence;
  placement: Placement;
}

export function validateCadence(cadence: Cadence): void {
  switch (cadence.kind) {
    case "daily":
      return;
    case "weekdays":
      if (cadence.days.length === 0) throw new Error("weekdays cadence requires at least one day");
      if (new Set(cadence.days).size !== cadence.days.length) {
        throw new Error("weekdays cadence days must be unique");
      }
      for (const day of cadence.days) {
        if (!Number.isInteger(day) || day < 1 || day > 7) {
          throw new Error(`weekdays cadence day out of range 1-7: ${day}`);
        }
      }
      return;
    case "interval":
      if (!Number.isInteger(cadence.everyDays) || cadence.everyDays <= 0) {
        throw new Error("interval cadence everyDays must be a positive integer");
      }
      return;
    case "month_days":
      if (cadence.days.length === 0) throw new Error("month_days cadence requires at least one day");
      if (new Set(cadence.days).size !== cadence.days.length) {
        throw new Error("month_days cadence days must be unique");
      }
      for (const day of cadence.days) {
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          throw new Error(`month_days cadence day out of range 1-31: ${day}`);
        }
      }
      return;
    case "one_time":
      return;
  }
}

export function validatePlacement(placement: Placement): void {
  if (placement.kind === "times") {
    if (placement.minutes.length === 0) {
      throw new Error("times placement requires at least one time");
    }
    if (new Set(placement.minutes).size !== placement.minutes.length) {
      throw new Error("times placement minutes must be unique");
    }
  }
}

/**
 * True when `date` is a cadence occurrence date. Calendar-only; a
 * nonexistent month day (e.g. 31 in February) is skipped, never clamped,
 * because the caller only ever asks about real calendar dates.
 */
export function cadenceMatches(cadence: Cadence, date: LocalDate): boolean {
  switch (cadence.kind) {
    case "daily":
      return true;
    case "weekdays":
      return cadence.days.includes(isoWeekdayOf(date));
    case "interval": {
      if (compareLocalDate(date, cadence.anchorDate) < 0) return false;
      const diff = daysBetween(cadence.anchorDate, date);
      return diff % cadence.everyDays === 0;
    }
    case "month_days":
      return cadence.days.includes(dayOfMonthOf(date));
    case "one_time":
      return compareLocalDate(date, cadence.date) === 0;
  }
}
