import { describe, expect, it } from "vitest";
import { computeShiftWindow, instantInWindow, localDateTimeToInstant } from "../../src/domain/time.js";
import { parseHHmm, toLocalDate } from "../../src/domain/types.js";

const FACILITY_TZ = "America/Denver"; // fixed non-UTC facility timezone for tests

describe("computeShiftWindow", () => {
  it("treats endMinutes > startMinutes as a same-day shift", () => {
    const window = computeShiftWindow(
      { startMinutes: parseHHmm("0700"), endMinutes: parseHHmm("1500") },
      toLocalDate("2026-09-05"),
      FACILITY_TZ
    );
    expect(window.isOvernight).toBe(false);
    expect(window.endDate).toBe("2026-09-05");
  });

  it("treats endMinutes <= startMinutes as overnight, ending the next day", () => {
    const window = computeShiftWindow(
      { startMinutes: parseHHmm("2300"), endMinutes: parseHHmm("0700") },
      toLocalDate("2026-09-05"),
      FACILITY_TZ
    );
    expect(window.isOvernight).toBe(true);
    expect(window.endDate).toBe("2026-09-06");
  });

  it("AC-06: a 2300-0700 shift on Sept 5 includes 2300 and 0100 next day, and excludes the 0700 end boundary", () => {
    const window = computeShiftWindow(
      { startMinutes: parseHHmm("2300"), endMinutes: parseHHmm("0700") },
      toLocalDate("2026-09-05"),
      FACILITY_TZ
    );
    const at2300 = localDateTimeToInstant(toLocalDate("2026-09-05"), parseHHmm("2300"), FACILITY_TZ);
    const at0100next = localDateTimeToInstant(toLocalDate("2026-09-06"), parseHHmm("0100"), FACILITY_TZ);
    const at0700end = localDateTimeToInstant(toLocalDate("2026-09-06"), parseHHmm("0700"), FACILITY_TZ);

    expect(instantInWindow(at2300, window)).toBe(true);
    expect(instantInWindow(at0100next, window)).toBe(true);
    expect(instantInWindow(at0700end, window)).toBe(false); // half-open [start, end)
  });

  it("excludes an instant exactly at shift start minus one minute", () => {
    const window = computeShiftWindow(
      { startMinutes: parseHHmm("0700"), endMinutes: parseHHmm("1500") },
      toLocalDate("2026-09-05"),
      FACILITY_TZ
    );
    const beforeStart = localDateTimeToInstant(toLocalDate("2026-09-05"), parseHHmm("0659"), FACILITY_TZ);
    expect(instantInWindow(beforeStart, window)).toBe(false);
  });

  it("includes the exact start instant (0000 midnight boundary)", () => {
    const window = computeShiftWindow(
      { startMinutes: parseHHmm("0000"), endMinutes: parseHHmm("0800") },
      toLocalDate("2026-09-05"),
      FACILITY_TZ
    );
    expect(instantInWindow(window.start, window)).toBe(true);
  });
});

describe("parseHHmm / formatHHmm", () => {
  it("round-trips valid times", () => {
    expect(parseHHmm("0700")).toBe(420);
    expect(parseHHmm("2359")).toBe(1439);
    expect(parseHHmm("0000")).toBe(0);
  });

  it("rejects invalid times", () => {
    expect(() => parseHHmm("2400")).toThrow();
    expect(() => parseHHmm("9999")).toThrow();
    expect(() => parseHHmm("7:00")).toThrow();
  });
});
