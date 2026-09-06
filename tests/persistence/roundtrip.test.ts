import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { openDatabase } from "../../src/infra/db/connection.js";
import { createSqliteRepositories } from "../../src/infra/db/sqliteRepositories.js";
import { getSchemaVersion } from "../../src/infra/db/migrations.js";
import { parseHHmm, toLocalDate } from "../../src/domain/types.js";
import type { Repositories } from "../../src/application/ports.js";

let dir: string;
let dbPath: string;
let db: Database.Database;
let repos: Repositories;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tasksheet-test-"));
  dbPath = join(dir, "tasksheet.sqlite3");
  db = openDatabase(dbPath);
  repos = createSqliteRepositories(db);
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("AC-04: restart persistence", () => {
  it("retains committed records after closing and reopening the database file", () => {
    repos.unitOfWork.runMutation(() => {
      repos.facility.save({
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
      });
      repos.rooms.create({ id: "room-1", label: "101", sortKey: "000101", active: true });
      repos.beds.create({ id: "bed-1", roomId: "room-1", label: "A", active: true });
      repos.residents.create({
        id: "res-1",
        firstName: "Fictional",
        lastName: "Resident",
        status: "active",
        source: "manual",
        sourceBatchId: null
      });
      repos.placements.create({
        id: "place-1",
        residentId: "res-1",
        bedId: "bed-1",
        startDate: toLocalDate("2026-01-01"),
        endDate: null
      });
      repos.shifts.create({
        id: "shift-1",
        shortCode: "D1",
        name: "Day HCA",
        role: "HCA",
        startMinutes: parseHHmm("0700"),
        endMinutes: parseHHmm("1500"),
        active: true,
        displayOrder: 1
      });
    });

    db.close();
    const reopened = openDatabase(dbPath);
    const reopenedRepos = createSqliteRepositories(reopened);

    expect(reopenedRepos.facility.get()?.name).toBe("Fictional Pines Care Home");
    expect(reopenedRepos.residents.listActive()).toHaveLength(1);
    expect(reopenedRepos.placements.currentForResident("res-1")?.bedId).toBe("bed-1");
    expect(reopenedRepos.shifts.listActive()).toHaveLength(1);
    reopened.close();
  });

  it("migrations are idempotent — reopening an already-migrated file is a safe no-op", () => {
    const versionAfterFirstOpen = getSchemaVersion(db);
    expect(versionAfterFirstOpen).toBeGreaterThan(0);
    db.close();
    const reopened = openDatabase(dbPath);
    expect(getSchemaVersion(reopened)).toBe(versionAfterFirstOpen);
    reopened.close();
  });
});

describe("domain invariants enforced at the persistence boundary", () => {
  it("rejects a second current placement for the same resident (one resident, one current placement)", () => {
    repos.residents.create({ id: "res-1", firstName: "A", lastName: "B", status: "active", source: "manual", sourceBatchId: null });
    repos.rooms.create({ id: "room-1", label: "101", sortKey: "101", active: true });
    repos.beds.create({ id: "bed-1", roomId: "room-1", label: "A", active: true });
    repos.beds.create({ id: "bed-2", roomId: "room-1", label: "B", active: true });
    repos.placements.create({ id: "p1", residentId: "res-1", bedId: "bed-1", startDate: toLocalDate("2026-01-01"), endDate: null });

    expect(() =>
      repos.placements.create({ id: "p2", residentId: "res-1", bedId: "bed-2", startDate: toLocalDate("2026-01-02"), endDate: null })
    ).toThrow();
  });

  it("rejects a second current occupant for the same bed (one bed, one current resident)", () => {
    repos.residents.create({ id: "res-1", firstName: "A", lastName: "B", status: "active", source: "manual", sourceBatchId: null });
    repos.residents.create({ id: "res-2", firstName: "C", lastName: "D", status: "active", source: "manual", sourceBatchId: null });
    repos.rooms.create({ id: "room-1", label: "101", sortKey: "101", active: true });
    repos.beds.create({ id: "bed-1", roomId: "room-1", label: "A", active: true });
    repos.placements.create({ id: "p1", residentId: "res-1", bedId: "bed-1", startDate: toLocalDate("2026-01-01"), endDate: null });

    expect(() =>
      repos.placements.create({ id: "p2", residentId: "res-2", bedId: "bed-1", startDate: toLocalDate("2026-01-02"), endDate: null })
    ).toThrow();
  });

  it("rejects a duplicate active short code among active shifts", () => {
    repos.shifts.create({
      id: "s1",
      shortCode: "D1",
      name: "Day HCA",
      role: "HCA",
      startMinutes: parseHHmm("0700"),
      endMinutes: parseHHmm("1500"),
      active: true,
      displayOrder: 1
    });
    expect(repos.shifts.isShortCodeTaken("D1")).toBe(true);
    expect(() =>
      repos.shifts.create({
        id: "s2",
        shortCode: "D1",
        name: "Day HCA duplicate",
        role: "HCA",
        startMinutes: parseHHmm("0700"),
        endMinutes: parseHHmm("1500"),
        active: true,
        displayOrder: 2
      })
    ).toThrow();
  });

  it("a mutation transaction rolls back atomically on failure — the dataset revision does not advance", () => {
    const before = repos.unitOfWork.currentDatasetRevision();
    expect(() =>
      repos.unitOfWork.runMutation(() => {
        repos.residents.create({ id: "res-1", firstName: "A", lastName: "B", status: "active", source: "manual", sourceBatchId: null });
        // Second create with the same id violates the primary key inside the same transaction.
        repos.residents.create({ id: "res-1", firstName: "A", lastName: "B", status: "active", source: "manual", sourceBatchId: null });
      })
    ).toThrow();
    expect(repos.unitOfWork.currentDatasetRevision()).toBe(before);
    expect(repos.residents.listActive()).toHaveLength(0);
  });

  it("bumps the dataset revision exactly once per committed mutation", () => {
    const before = repos.unitOfWork.currentDatasetRevision();
    repos.unitOfWork.runMutation(() => {
      repos.residents.create({ id: "res-1", firstName: "A", lastName: "B", status: "active", source: "manual", sourceBatchId: null });
    });
    expect(repos.unitOfWork.currentDatasetRevision()).toBe(before + 1);
  });
});
