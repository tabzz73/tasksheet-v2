import { describe, expect, it } from "vitest";
import { resolveLocalDateTime, computeShiftWindow, instantInWindow } from "../../src/domain/time.js";
import { generateAssignmentDocument } from "../../src/domain/generation.js";
import { parseHHmm, toLocalDate } from "../../src/domain/types.js";
import type { FacilitySettings, Shift } from "../../src/domain/entities.js";

const FACILITY_TZ = "America/Denver"; // real US DST-observing zone used throughout the fixtures

// Real America/Denver 2026 transitions used as the required fixtures
// (DATA-CONTRACTS.md §2): spring-forward on 2026-03-08 (02:00 MST -> 03:00
// MDT, a 60-minute gap covering local 02:00-02:59), fall-back on
// 2026-11-01 (02:00 MDT -> 01:00 MST, so local 01:00-01:59 occurs twice).

describe("AC-08: DST gap (spring-forward, real America/Denver 2026-03-08 transition)", () => {
  it("a wall time inside the gap (0230, which never occurs) moves forward by the gap duration and is flagged", () => {
    const resolved = resolveLocalDateTime(toLocalDate("2026-03-08"), parseHHmm("0230"), FACILITY_TZ);
    expect(resolved.gapAdjusted).toBe(true);
    expect(resolved.foldResolved).toBe(false);
    // Moved forward by the 60-minute gap: 0230 -> effectively 0330 MDT (09:30Z).
    expect(resolved.instant).toBe("2026-03-08T09:30:00.000Z");
  });

  it("a wall time just before the gap (0159) resolves normally, unaffected", () => {
    const resolved = resolveLocalDateTime(toLocalDate("2026-03-08"), parseHHmm("0159"), FACILITY_TZ);
    expect(resolved.gapAdjusted).toBe(false);
    expect(resolved.foldResolved).toBe(false);
    expect(resolved.instant).toBe("2026-03-08T08:59:00.000Z"); // 0159 MST = 0859Z
  });

  it("a wall time just after the gap (0300, the first valid MDT instant) resolves normally, unaffected", () => {
    const resolved = resolveLocalDateTime(toLocalDate("2026-03-08"), parseHHmm("0300"), FACILITY_TZ);
    expect(resolved.gapAdjusted).toBe(false);
    expect(resolved.instant).toBe("2026-03-08T09:00:00.000Z"); // 0300 MDT = 0900Z
  });

  it("preserves the original local slot as occurrence identity: the generated row still shows 0230, not the adjusted 0330", () => {
    const facility = makeFacility();
    const shift: Shift = {
      id: "shift-day",
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startMinutes: parseHHmm("0000"),
      endMinutes: parseHHmm("0800"),
      active: true,
      displayOrder: 1
    };
    const doc = generateAssignmentDocument({
      facility,
      shift,
      date: toLocalDate("2026-03-08"),
      residents: [{ id: "res-1", firstName: "Fictional", lastName: "Resident", status: "active", source: "manual", sourceBatchId: null }],
      rooms: [{ id: "room-1", label: "101", sortKey: "101", active: true }],
      beds: [{ id: "bed-1", roomId: "room-1", label: "A", active: true }],
      placements: [{ id: "place-1", residentId: "res-1", bedId: "bed-1", startDate: toLocalDate("2026-01-01"), endDate: null }],
      tasks: [
        {
          id: "task-1",
          residentId: "res-1",
          role: "HCA",
          eligibleShiftIds: ["shift-day"],
          schedule: { cadence: { kind: "daily" }, placement: { kind: "times", minutes: [parseHHmm("0230")] } },
          scheduleRevision: 1,
          activeFrom: toLocalDate("2026-01-01"),
          activeTo: null,
          active: true,
          catalog: { catalogItemId: "cat-1", version: 1, name: "Overnight check", category: "clinical", instructions: "" },
          importantInformation: null,
          showOnPrint: true,
          source: "manual",
          sourceBatchId: null
        }
      ],
      generatedAt: "2026-03-08T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    });

    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]?.time).toBe("0230"); // original nominal slot, not "0330"
    expect(doc.warnings.some((w) => w.includes("daylight-saving-time gap"))).toBe(true);
  });
});

describe("AC-08: DST fold (fall-back, real America/Denver 2026-11-01 transition)", () => {
  it("a wall time that occurs twice (0130) resolves to the earlier of the two real instants", () => {
    const resolved = resolveLocalDateTime(toLocalDate("2026-11-01"), parseHHmm("0130"), FACILITY_TZ);
    expect(resolved.foldResolved).toBe(true);
    expect(resolved.gapAdjusted).toBe(false);
    // Earlier instant: 0130 MDT (before the fall-back), not 0130 MST (after it).
    expect(resolved.instant).toBe("2026-11-01T07:30:00.000Z");
  });

  it("resolving the same ambiguous wall time repeatedly is deterministic (always the earlier instant, never both)", () => {
    const first = resolveLocalDateTime(toLocalDate("2026-11-01"), parseHHmm("0130"), FACILITY_TZ);
    const second = resolveLocalDateTime(toLocalDate("2026-11-01"), parseHHmm("0130"), FACILITY_TZ);
    expect(first.instant).toBe(second.instant);
  });

  it("a wall time outside the fold (0059, before it starts) resolves normally", () => {
    const resolved = resolveLocalDateTime(toLocalDate("2026-11-01"), parseHHmm("0059"), FACILITY_TZ);
    expect(resolved.foldResolved).toBe(false);
    expect(resolved.instant).toBe("2026-11-01T06:59:00.000Z"); // 0059 MDT = 0659Z
  });

  it("a wall time outside the fold (0200, after MST resumes) resolves normally", () => {
    const resolved = resolveLocalDateTime(toLocalDate("2026-11-01"), parseHHmm("0200"), FACILITY_TZ);
    expect(resolved.foldResolved).toBe(false);
    expect(resolved.instant).toBe("2026-11-01T09:00:00.000Z"); // 0200 MST = 0900Z
  });
});

describe("AC-08: shift endpoints resolve by the same gap/fold policy", () => {
  it("an overnight shift ending at the exact fold-ambiguous wall time still produces a well-defined half-open window", () => {
    const window = computeShiftWindow(
      { startMinutes: parseHHmm("2300"), endMinutes: parseHHmm("0130") },
      toLocalDate("2026-10-31"),
      FACILITY_TZ
    );
    expect(window.isOvernight).toBe(true);
    // The end instant resolves to the earlier of the two real 0130 instants on 2026-11-01,
    // per the same fold policy resolveLocalDateTime uses for occurrences.
    expect(window.end).toBe("2026-11-01T07:30:00.000Z");
    const justBeforeEnd = resolveLocalDateTime(toLocalDate("2026-11-01"), parseHHmm("0129"), FACILITY_TZ).instant;
    expect(instantInWindow(justBeforeEnd, window)).toBe(true);
  });
});

function makeFacility(): FacilitySettings {
  return {
    facilityId: "fac-1",
    name: "Fictional Pines Care Home",
    addressLine1: "1 Fictional Way",
    addressLine2: null,
    mainPhone: "555-0100",
    nursingPhone: null,
    fax: null,
    timeZone: FACILITY_TZ,
    weekStart: 1,
    escalationThreshold: 3,
    inactivityLockMinutes: 10
  };
}
