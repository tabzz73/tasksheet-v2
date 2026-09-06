import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { openDatabase } from "../../src/infra/db/connection.js";
import { createSqliteRepositories } from "../../src/infra/db/sqliteRepositories.js";
import type { Repositories } from "../../src/application/ports.js";
import { FixedClock } from "../../src/application/clock.js";
import { SessionManager } from "../../src/application/auth/sessionManager.js";
import { adminResetPassword, bootstrapFirstAdmin, createAccount, login, setAccountRoleAndGrants } from "../../src/application/useCases/auth.js";
import {
  authorizedCreateBed,
  authorizedCreateResident,
  authorizedCreateResidentTask,
  authorizedCreateRoom,
  authorizedCreateShift,
  authorizedDeactivateShift,
  authorizedGenerateAssignment,
  authorizedGetFacility,
  authorizedListShifts,
  authorizedPlaceResident,
  authorizedSaveFacilitySettings
} from "../../src/application/authorizedUseCases.js";

let dir: string;
let db: Database.Database;
let repos: Repositories;
let sessions: SessionManager;
const clock = new FixedClock("2026-09-05T12:00:00.000Z" as never);

const FACILITY_INPUT = {
  facilityId: "facility-1",
  name: "Fictional Pines Care Home",
  addressLine1: "1 Fictional Way",
  addressLine2: null,
  mainPhone: "555-0100",
  nursingPhone: null,
  fax: null,
  timeZone: "America/Denver",
  weekStart: 1 as const,
  escalationThreshold: 3
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "tasksheet-authz-test-"));
  db = openDatabase(join(dir, "tasksheet.sqlite"));
  repos = createSqliteRepositories(db);
  sessions = new SessionManager();

  await bootstrapFirstAdmin(repos, clock, { alias: "admin", password: "correct horse battery staple" });
  await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

async function loginAs(alias: string, password: string, role: "Editor" | "Viewer", senderKey: string) {
  const created = await createAccount(repos, sessions, clock, "admin-sender", { alias, password, role, grants: [] });
  if (created.kind !== "success") throw new Error(`fixture account creation failed: ${JSON.stringify(created)}`);
  const loggedIn = await login(repos, sessions, clock, senderKey, { alias, password });
  if (loggedIn.kind !== "success") throw new Error(`fixture login failed: ${JSON.stringify(loggedIn)}`);
  return created.value;
}

describe("AC-45: role defaults enforced on every mutating operation, direct at the authorized-use-case layer (the exact function every IPC handler calls)", () => {
  it("an unauthenticated sender (no session at all — the forged/absent-session case) is denied everything", () => {
    expect(authorizedGetFacility(repos, sessions, clock, "nobody").kind).toBe("unauthenticated");
    expect(authorizedListShifts(repos, sessions, clock, "nobody").kind).toBe("unauthenticated");
    expect(authorizedCreateRoom(repos, sessions, clock, "nobody", { label: "101" }).kind).toBe("unauthenticated");
  });

  it("Viewer cannot mutate any record", async () => {
    await loginAs("viewer1", "viewer starting password 1", "Viewer", "viewer-sender");

    const facilityResult = authorizedSaveFacilitySettings(repos, sessions, clock, "viewer-sender", FACILITY_INPUT);
    expect(facilityResult.kind).toBe("forbidden");

    const shiftResult = authorizedCreateShift(repos, sessions, clock, "viewer-sender", {
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    expect(shiftResult.kind).toBe("forbidden");

    const roomResult = authorizedCreateRoom(repos, sessions, clock, "viewer-sender", { label: "101" });
    expect(roomResult.kind).toBe("forbidden");

    const residentResult = authorizedCreateResident(repos, sessions, clock, "viewer-sender", { firstName: "A", lastName: "B" });
    expect(residentResult.kind).toBe("forbidden");
  });

  it("Viewer CAN read and CAN generate/preview the assignment document (view+print is allowed to every role)", async () => {
    await loginAs("viewer1", "viewer starting password 1", "Viewer", "viewer-sender");
    authorizedSaveFacilitySettings(repos, sessions, clock, "admin-sender", FACILITY_INPUT);
    const shift = authorizedCreateShift(repos, sessions, clock, "admin-sender", {
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    if (shift.kind !== "success") throw new Error("fixture failed");

    expect(authorizedGetFacility(repos, sessions, clock, "viewer-sender").kind).toBe("success");
    expect(authorizedListShifts(repos, sessions, clock, "viewer-sender").kind).toBe("success");
    const doc = authorizedGenerateAssignment(repos, sessions, clock, "viewer-sender", { date: "2026-09-05", shiftId: shift.value.id });
    expect(doc.kind).toBe("success");
  });

  it("Editor can create operational records (resident) but not update facility settings (Administrator-only)", async () => {
    await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");

    const resident = authorizedCreateResident(repos, sessions, clock, "editor-sender", { firstName: "Fictional", lastName: "Resident" });
    expect(resident.kind).toBe("success");

    const facilityResult = authorizedSaveFacilitySettings(repos, sessions, clock, "editor-sender", FACILITY_INPUT);
    expect(facilityResult.kind).toBe("forbidden");
  });

  it("Editor cannot create a room/bed/shift without the matching grant (ACCESS-CONTROL.md §2: Grant per resource/action)", async () => {
    await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");

    expect(authorizedCreateRoom(repos, sessions, clock, "editor-sender", { label: "101" }).kind).toBe("forbidden");
    expect(
      authorizedCreateShift(repos, sessions, clock, "editor-sender", { shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500" })
        .kind
    ).toBe("forbidden");
  });

  it("granting room.create lets an Editor create a room, without also granting shift.create", async () => {
    const editor = await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");
    setAccountRoleAndGrants(repos, sessions, clock, "admin-sender", { targetAccountId: editor.id, role: "Editor", grants: ["room.create"] });
    await login(repos, sessions, clock, "editor-sender", { alias: "editor1", password: "editor starting password 1" });

    expect(authorizedCreateRoom(repos, sessions, clock, "editor-sender", { label: "101" }).kind).toBe("success");
    expect(
      authorizedCreateShift(repos, sessions, clock, "editor-sender", { shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500" })
        .kind
    ).toBe("forbidden");
  });

  it("full Editor workflow: room, bed, resident, placement and task all succeed without any archive/delete power", async () => {
    await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");
    authorizedSaveFacilitySettings(repos, sessions, clock, "admin-sender", FACILITY_INPUT);
    const shift = authorizedCreateShift(repos, sessions, clock, "admin-sender", {
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    if (shift.kind !== "success") throw new Error("fixture failed");

    // Room/bed creation is Administrator-only-by-default (ACCESS-CONTROL.md
    // §2's "Grant per resource/action" row) — the Editor default set only
    // covers resident/placement/task, so these are seeded by the admin.
    const room = authorizedCreateRoom(repos, sessions, clock, "admin-sender", { label: "101" });
    if (room.kind !== "success") throw new Error("room failed");
    const bed = authorizedCreateBed(repos, sessions, clock, "admin-sender", { roomId: room.value.id, label: "A" });
    if (bed.kind !== "success") throw new Error("bed failed");
    const resident = authorizedCreateResident(repos, sessions, clock, "editor-sender", { firstName: "Fictional", lastName: "Resident" });
    if (resident.kind !== "success") throw new Error("resident failed");
    const placement = authorizedPlaceResident(repos, sessions, clock, "editor-sender", {
      residentId: resident.value.id,
      bedId: bed.value.id,
      startDate: "2026-01-01"
    });
    expect(placement.kind).toBe("success");
    const task = authorizedCreateResidentTask(repos, sessions, clock, "editor-sender", {
      residentId: resident.value.id,
      role: "HCA",
      eligibleShiftIds: [shift.value.id],
      taskName: "Blood glucose check",
      cadence: { kind: "daily" },
      placement: { kind: "times", times: ["0900"] },
      activeFrom: "2026-01-01"
    });
    expect(task.kind).toBe("success");
  });
});

describe("AC-46: Editor cannot bypass deletion/deactivation restrictions without the exact grant", () => {
  it("Editor without the shift.deactivate grant is forbidden from deactivating a shift", async () => {
    const shift = authorizedCreateShift(repos, sessions, clock, "admin-sender", {
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    if (shift.kind !== "success") throw new Error("fixture failed");
    const editor = await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");

    const denied = authorizedDeactivateShift(repos, sessions, clock, "editor-sender", { shiftId: shift.value.id });
    expect(denied.kind).toBe("forbidden");
    // Denial must not have mutated anything.
    expect(repos.shifts.findById(shift.value.id)?.active).toBe(true);
    void editor;
  });

  it("granting exactly shift.deactivate enables only that operation, not accounts.manage or facility.update", async () => {
    const shift = authorizedCreateShift(repos, sessions, clock, "admin-sender", {
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    if (shift.kind !== "success") throw new Error("fixture failed");
    const editor = await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");

    const grantResult = setAccountRoleAndGrants(repos, sessions, clock, "admin-sender", {
      targetAccountId: editor.id,
      role: "Editor",
      grants: ["shift.deactivate"]
    });
    expect(grantResult.kind).toBe("success");

    // The grant revokes the editor's outstanding session (ACCESS-CONTROL.md §2: "Role changes... revoke sessions").
    const staleAttempt = authorizedDeactivateShift(repos, sessions, clock, "editor-sender", { shiftId: shift.value.id });
    expect(staleAttempt.kind).toBe("unauthenticated");

    await login(repos, sessions, clock, "editor-sender", { alias: "editor1", password: "editor starting password 1" });
    const allowed = authorizedDeactivateShift(repos, sessions, clock, "editor-sender", { shiftId: shift.value.id });
    expect(allowed.kind).toBe("success");
    expect(repos.shifts.findById(shift.value.id)?.active).toBe(false);

    // The same grant does not extend to Administrator-only capabilities.
    const stillDenied = authorizedSaveFacilitySettings(repos, sessions, clock, "editor-sender", FACILITY_INPUT);
    expect(stillDenied.kind).toBe("forbidden");
  });

  it("revoking a grant denies the very next request from an existing session, without waiting for logout", async () => {
    const shift = authorizedCreateShift(repos, sessions, clock, "admin-sender", {
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    if (shift.kind !== "success") throw new Error("fixture failed");
    const editor = await loginAs("editor1", "editor starting password 1", "Editor", "editor-sender");
    setAccountRoleAndGrants(repos, sessions, clock, "admin-sender", { targetAccountId: editor.id, role: "Editor", grants: ["shift.deactivate"] });
    await login(repos, sessions, clock, "editor-sender", { alias: "editor1", password: "editor starting password 1" });
    expect(authorizedDeactivateShift(repos, sessions, clock, "editor-sender", { shiftId: shift.value.id }).kind).toBe("success");

    // Admin revokes the grant again.
    setAccountRoleAndGrants(repos, sessions, clock, "admin-sender", { targetAccountId: editor.id, role: "Editor", grants: [] });

    // The editor's session object still exists in memory, but the very next
    // request must be denied — this is the "revoked account cannot recover
    // through a replay" property (ACCESS-CONTROL.md §4).
    const secondShift = authorizedCreateShift(repos, sessions, clock, "admin-sender", {
      shortCode: "D2",
      name: "Day HCA 2",
      role: "HCA",
      startTime: "0700",
      endTime: "1500"
    });
    if (secondShift.kind !== "success") throw new Error("fixture failed");
    const deniedAfterRevoke = authorizedDeactivateShift(repos, sessions, clock, "editor-sender", { shiftId: secondShift.value.id });
    expect(deniedAfterRevoke.kind).toBe("unauthenticated");
  });
});

describe("mustChangePassword blocks ordinary operations until changed", () => {
  it("an account with an admin-forced reset cannot mutate records before changing its password", async () => {
    const created = await createAccount(repos, sessions, clock, "admin-sender", {
      alias: "editor1",
      password: "editor starting password 1",
      role: "Editor",
      grants: []
    });
    if (created.kind !== "success") throw new Error("fixture failed");
    await login(repos, sessions, clock, "editor-sender", { alias: "editor1", password: "editor starting password 1" });
    expect(authorizedCreateResident(repos, sessions, clock, "editor-sender", { firstName: "A", lastName: "B" }).kind).toBe("success");

    const reset = await adminResetPassword(repos, sessions, clock, "admin-sender", {
      adminCurrentPassword: "correct horse battery staple",
      targetAccountId: created.value.id,
      newPassword: "editor password after admin reset"
    });
    if (reset.kind !== "success") throw new Error("reset failed");
    await login(repos, sessions, clock, "editor-sender-2", { alias: "editor1", password: "editor password after admin reset" });

    const result = authorizedCreateResident(repos, sessions, clock, "editor-sender-2", { firstName: "C", lastName: "D" });
    expect(result.kind).toBe("forbidden");
  });
});
