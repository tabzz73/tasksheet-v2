import { describe, expect, it } from "vitest";
import { generateAssignmentDocument, GUIDE_NOTICE } from "../../src/domain/generation.js";
import { parseHHmm, toLocalDate } from "../../src/domain/types.js";
import type { FacilitySettings, Shift } from "../../src/domain/entities.js";

const facility: FacilitySettings = {
  facilityId: "fac-1",
  name: "Fictional Pines Care Home",
  addressLine1: "1 Fictional Way",
  addressLine2: null,
  mainPhone: "555-0100",
  nursingPhone: "555-0101",
  fax: null,
  timeZone: "America/Denver",
  weekStart: 1,
  escalationThreshold: 3
};

const hcaShift: Shift = {
  id: "shift-hca-day",
  shortCode: "D1",
  name: "Day HCA",
  role: "HCA",
  startMinutes: parseHHmm("0700"),
  endMinutes: parseHHmm("1500"),
  active: true,
  displayOrder: 1
};

const lpnShift: Shift = {
  id: "shift-lpn-day",
  shortCode: "D1LPN",
  name: "Day LPN",
  role: "LPN",
  startMinutes: parseHHmm("0700"),
  endMinutes: parseHHmm("1500"),
  active: true,
  displayOrder: 2
};

const baseFixture = {
  residents: [
    { id: "res-1", firstName: "Fictional", lastName: "Resident", status: "active" as const, source: "manual" as const, sourceBatchId: null }
  ],
  rooms: [{ id: "room-1", label: "101", sortKey: "101", active: true }],
  beds: [{ id: "bed-1", roomId: "room-1", label: "A", active: true }],
  placements: [{ id: "place-1", residentId: "res-1", bedId: "bed-1", startDate: toLocalDate("2026-01-01"), endDate: null }]
};

describe("generateAssignmentDocument — AC-02/AC-03", () => {
  const task = {
    id: "task-1",
    residentId: "res-1",
    role: "HCA" as const,
    eligibleShiftIds: ["shift-hca-day"],
    schedule: { cadence: { kind: "daily" as const }, placement: { kind: "times" as const, minutes: [parseHHmm("0900")] } },
    scheduleRevision: 1,
    activeFrom: toLocalDate("2026-01-01"),
    activeTo: null,
    active: true,
    catalog: { catalogItemId: "cat-1", version: 1, name: "Blood glucose check", category: "clinical", instructions: "Check before breakfast" },
    importantInformation: "Diabetic — check before breakfast",
    showOnPrint: true,
    source: "manual" as const,
    sourceBatchId: null
  };

  it("AC-02: exactly one eligible HCA task on the correct resident/room/time", () => {
    const doc = generateAssignmentDocument({
      facility,
      shift: hcaShift,
      date: toLocalDate("2026-09-05"),
      ...baseFixture,
      tasks: [task],
      generatedAt: "2026-09-05T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    });

    expect(doc.kind).toBe("hca-assignment");
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({
      time: "0900",
      room: "101",
      residentFirstName: "Fictional",
      residentLastName: "Resident",
      taskName: "Blood glucose check"
    });
    expect(doc.notice).toBe(GUIDE_NOTICE);
  });

  it("AC-03: the equivalent LPN task produces the same content snapshot under the LPN document kind", () => {
    const lpnTask = { ...task, id: "task-2", role: "LPN" as const, eligibleShiftIds: ["shift-lpn-day"] };
    const doc = generateAssignmentDocument({
      facility,
      shift: lpnShift,
      date: toLocalDate("2026-09-05"),
      ...baseFixture,
      tasks: [lpnTask],
      generatedAt: "2026-09-05T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    });

    expect(doc.kind).toBe("lpn-assignment");
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]?.taskName).toBe("Blood glucose check");
    expect(doc.notice).toBe(GUIDE_NOTICE);
  });

  it("is deterministic for the same inputs", () => {
    const input = {
      facility,
      shift: hcaShift,
      date: toLocalDate("2026-09-05"),
      ...baseFixture,
      tasks: [task],
      generatedAt: "2026-09-05T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    };
    const first = generateAssignmentDocument(input);
    const second = generateAssignmentDocument(input);
    expect(first).toEqual(second);
  });
});

describe("generateAssignmentDocument — exclusions", () => {
  const task = {
    id: "task-1",
    residentId: "res-1",
    role: "HCA" as const,
    eligibleShiftIds: ["shift-hca-day"],
    schedule: { cadence: { kind: "daily" as const }, placement: { kind: "times" as const, minutes: [parseHHmm("0900")] } },
    scheduleRevision: 1,
    activeFrom: toLocalDate("2026-01-01"),
    activeTo: null,
    active: true,
    catalog: { catalogItemId: "cat-1", version: 1, name: "Blood glucose check", category: "clinical", instructions: "" },
    importantInformation: null,
    showOnPrint: true,
    source: "manual" as const,
    sourceBatchId: null
  };

  it("AC-10: excludes an inactive task", () => {
    const doc = generateAssignmentDocument({
      facility,
      shift: hcaShift,
      date: toLocalDate("2026-09-05"),
      ...baseFixture,
      tasks: [{ ...task, active: false }],
      generatedAt: "2026-09-05T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    });
    expect(doc.rows).toHaveLength(0);
  });

  it("AC-10: excludes a task outside the assigned shift", () => {
    const doc = generateAssignmentDocument({
      facility,
      shift: hcaShift,
      date: toLocalDate("2026-09-05"),
      ...baseFixture,
      tasks: [{ ...task, eligibleShiftIds: ["some-other-shift"] }],
      generatedAt: "2026-09-05T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    });
    expect(doc.rows).toHaveLength(0);
  });

  it("AC-10: excludes an away/inactive resident and their task", () => {
    const doc = generateAssignmentDocument({
      facility,
      shift: hcaShift,
      date: toLocalDate("2026-09-05"),
      residents: [{ ...baseFixture.residents[0]!, status: "in_hospital" }],
      rooms: baseFixture.rooms,
      beds: baseFixture.beds,
      placements: baseFixture.placements,
      tasks: [task],
      generatedAt: "2026-09-05T12:00:00.000Z" as never,
      sourceDatasetRevision: 1
    });
    expect(doc.rows).toHaveLength(0);
  });
});
