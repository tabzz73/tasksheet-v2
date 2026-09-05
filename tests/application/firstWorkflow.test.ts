import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { openDatabase } from "../../src/infra/db/connection.js";
import { createSqliteRepositories } from "../../src/infra/db/sqliteRepositories.js";
import type { Repositories } from "../../src/application/ports.js";
import { FixedClock } from "../../src/application/clock.js";
import { saveFacilitySettings } from "../../src/application/useCases/saveFacilitySettings.js";
import { createShift } from "../../src/application/useCases/createShift.js";
import { createRoom, createBed } from "../../src/application/useCases/roomsAndBeds.js";
import { createResident } from "../../src/application/useCases/createResident.js";
import { placeResident } from "../../src/application/useCases/placeResident.js";
import { createResidentTask } from "../../src/application/useCases/createResidentTask.js";
import { generateAssignmentDocument } from "../../src/application/useCases/generateAssignmentDocument.js";

let dir: string;
let db: Database.Database;
let repos: Repositories;
const clock = new FixedClock("2026-09-05T12:00:00.000Z" as never);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tasksheet-app-test-"));
  db = openDatabase(join(dir, "tasksheet.sqlite3"));
  repos = createSqliteRepositories(db);
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function mustSucceed<T>(result: { kind: string; value?: T; message?: string }): T {
  if (result.kind !== "success") {
    throw new Error(`Expected success, got ${result.kind}: ${result.message}`);
  }
  return result.value as T;
}

describe("Phase 1 first workflow: facility -> shift -> resident/bed -> task -> save -> generate", () => {
  it("AC-01/02: end-to-end setup produces exactly one eligible HCA task, and nothing appears uninvited", () => {
    mustSucceed(
      saveFacilitySettings(repos, {
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
      })
    );

    const shift = mustSucceed(
      createShift(repos, { shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500", displayOrder: 1 })
    );

    const room = mustSucceed(createRoom(repos, { label: "101" }));
    const bed = mustSucceed(createBed(repos, { roomId: room.id, label: "A" }));
    const resident = mustSucceed(createResident(repos, { firstName: "Fictional", lastName: "Resident" }));
    mustSucceed(placeResident(repos, { residentId: resident.id, bedId: bed.id, startDate: "2026-01-01" }));

    mustSucceed(
      createResidentTask(repos, {
        residentId: resident.id,
        role: "HCA",
        eligibleShiftIds: [shift.id],
        taskName: "Blood glucose check",
        category: "clinical",
        instructions: "Check before breakfast",
        importantInformation: "Diabetic — check before breakfast",
        cadence: { kind: "daily" },
        placement: { kind: "times", times: ["0900"] },
        activeFrom: "2026-01-01"
      })
    );

    const doc = mustSucceed(generateAssignmentDocument(repos, clock, { date: "2026-09-05", shiftId: shift.id }));

    expect(doc.kind).toBe("hca-assignment");
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({ room: "101", taskName: "Blood glucose check", time: "0900" });
    expect(doc.warnings).toHaveLength(0);
  });

  it("resident selectors never auto-select: placing a resident requires an explicit bed, an unknown id is rejected", () => {
    const resident = mustSucceed(createResident(repos, { firstName: "A", lastName: "B" }));
    const result = placeResident(repos, { residentId: resident.id, bedId: "", startDate: "2026-01-01" });
    expect(result.kind).toBe("validation");
  });

  it("rejects placing a second resident into an already-occupied bed (double occupancy)", () => {
    const room = mustSucceed(createRoom(repos, { label: "101" }));
    const bed = mustSucceed(createBed(repos, { roomId: room.id, label: "A" }));
    const r1 = mustSucceed(createResident(repos, { firstName: "A", lastName: "One" }));
    const r2 = mustSucceed(createResident(repos, { firstName: "B", lastName: "Two" }));
    mustSucceed(placeResident(repos, { residentId: r1.id, bedId: bed.id, startDate: "2026-01-01" }));

    const conflict = placeResident(repos, { residentId: r2.id, bedId: bed.id, startDate: "2026-01-02" });
    expect(conflict.kind).toBe("conflict");
  });

  it("rejects a duplicate active shift short code", () => {
    mustSucceed(createShift(repos, { shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500" }));
    const dup = createShift(repos, { shortCode: "D1", name: "Day HCA 2", role: "HCA", startTime: "0700", endTime: "1500" });
    expect(dup.kind).toBe("conflict");
  });

  it("generation is blocked with a clear validation message when no facility is configured", () => {
    const result = generateAssignmentDocument(repos, clock, { date: "2026-09-05", shiftId: "missing" });
    expect(result.kind).toBe("validation");
  });

  it("AC-03: an equivalent LPN task shares the same content snapshot under the LPN document kind", () => {
    mustSucceed(
      saveFacilitySettings(repos, {
        facilityId: "fac-1",
        name: "Fictional Pines Care Home",
        addressLine1: "1 Fictional Way",
        addressLine2: null,
        mainPhone: "555-0100",
        nursingPhone: null,
        fax: null,
        timeZone: "America/Denver",
        weekStart: 1,
        escalationThreshold: 3
      })
    );
    const shift = mustSucceed(
      createShift(repos, { shortCode: "D1LPN", name: "Day LPN", role: "LPN", startTime: "0700", endTime: "1500" })
    );
    const room = mustSucceed(createRoom(repos, { label: "101" }));
    const bed = mustSucceed(createBed(repos, { roomId: room.id, label: "A" }));
    const resident = mustSucceed(createResident(repos, { firstName: "Fictional", lastName: "Resident" }));
    mustSucceed(placeResident(repos, { residentId: resident.id, bedId: bed.id, startDate: "2026-01-01" }));
    mustSucceed(
      createResidentTask(repos, {
        residentId: resident.id,
        role: "LPN",
        eligibleShiftIds: [shift.id],
        taskName: "Wound check",
        cadence: { kind: "daily" },
        placement: { kind: "times", times: ["0900"] },
        activeFrom: "2026-01-01"
      })
    );

    const doc = mustSucceed(generateAssignmentDocument(repos, clock, { date: "2026-09-05", shiftId: shift.id }));
    expect(doc.kind).toBe("lpn-assignment");
    expect(doc.rows[0]?.taskName).toBe("Wound check");
    expect(doc.notice).toMatch(/guide only/);
  });
});
