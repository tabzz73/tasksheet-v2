import { describe, expect, it } from "vitest";
import { nextOccurrencePreviews } from "../../src/domain/schedule.js";
import { parseHHmm, toLocalDate } from "../../src/domain/types.js";

describe("nextOccurrencePreviews (task editor's next-7-occurrences review step)", () => {
  it("lists the next N daily occurrences with their configured times", () => {
    const schedule = { cadence: { kind: "daily" as const }, placement: { kind: "times" as const, minutes: [parseHHmm("0900")] } };
    const results = nextOccurrencePreviews(schedule, toLocalDate("2026-09-05"), 7);
    expect(results).toHaveLength(7);
    expect(results[0]).toEqual({ date: "2026-09-05", labels: ["0900"] });
    expect(results[6]!.date).toBe("2026-09-11");
  });

  it("respects activeTo — never previews an occurrence past the task's own end date", () => {
    const schedule = { cadence: { kind: "daily" as const }, placement: { kind: "times" as const, minutes: [parseHHmm("0900")] } };
    const results = nextOccurrencePreviews(schedule, toLocalDate("2026-09-05"), 7, toLocalDate("2026-09-06"));
    expect(results).toHaveLength(2);
  });

  it("skips a nonexistent month-day (e.g. day 31 in a 30-day month) rather than clamping", () => {
    const schedule = { cadence: { kind: "month_days" as const, days: [31] }, placement: { kind: "times" as const, minutes: [parseHHmm("0900")] } };
    const results = nextOccurrencePreviews(schedule, toLocalDate("2026-04-01"), 2);
    expect(results[0]!.date).toBe("2026-05-31");
  });

  it("stays anchored for an interval cadence", () => {
    const schedule = {
      cadence: { kind: "interval" as const, everyDays: 14, anchorDate: toLocalDate("2026-01-31") },
      placement: { kind: "times" as const, minutes: [parseHHmm("0700")] }
    };
    const results = nextOccurrencePreviews(schedule, toLocalDate("2026-09-01"), 2);
    // 2026-01-31 + 14*n: find first n on/after Sept 1.
    expect(results[0]!.date >= "2026-09-01").toBe(true);
    expect(results[1]!.date).not.toBe(results[0]!.date);
  });
});
