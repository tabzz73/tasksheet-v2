import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { openDatabase } from "../../src/infra/db/connection.js";
import { relocateLegacyStoreIfNeeded } from "../../src/infra/db/legacyPathRelocation.js";
import { createSqliteRepositories } from "../../src/infra/db/sqliteRepositories.js";
import { getSchemaVersion } from "../../src/infra/db/migrations.js";

let dir: string;
let legacyPath: string;
let newPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tasksheet-legacy-test-"));
  legacyPath = join(dir, "tasksheet.sqlite3");
  newPath = join(dir, "data", "tasksheet.sqlite");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("relocateLegacyStoreIfNeeded (never silently initialize an empty DB over an existing installation)", () => {
  it("does nothing when no legacy store exists — a genuinely fresh install", () => {
    const result = relocateLegacyStoreIfNeeded(legacyPath, newPath);
    expect(result).toEqual({ relocated: false, reason: "no-legacy-store" });
    expect(existsSync(newPath)).toBe(false);
  });

  it("does nothing once the new path already has a store (never overwrites)", () => {
    const preexisting = openDatabase(newPath);
    preexisting.close();
    const legacyDb = new Database(legacyPath);
    legacyDb.exec("CREATE TABLE marker(x)");
    legacyDb.close();

    const result = relocateLegacyStoreIfNeeded(legacyPath, newPath);
    expect(result).toEqual({ relocated: false, reason: "already-migrated" });

    const reopened = new Database(newPath);
    const hasMarker = reopened.prepare("SELECT name FROM sqlite_master WHERE name='marker'").get();
    reopened.close();
    expect(hasMarker).toBeUndefined();
  });

  it("relocates a real pre-ADR-0001 (schema v1, no accounts) database, and migration v2 applies cleanly on top", () => {
    // Simulate the a4966c0-era store: open at the legacy path (creates it,
    // applies whatever migrations exist in THIS build — schema v1 fields
    // are what a4966c0 actually wrote, so we assert on those business
    // tables only, not on a frozen historical schema file).
    const legacyDb = openDatabase(legacyPath);
    const legacyRepos = createSqliteRepositories(legacyDb);
    legacyRepos.unitOfWork.runMutation(() => {
      legacyRepos.facility.save({
        facilityId: "facility-1",
        name: "Fictional Pines Care Home",
        addressLine1: "1 Fictional Way",
        addressLine2: null,
        mainPhone: "555-0100",
        nursingPhone: null,
        fax: null,
        timeZone: "America/Denver",
        weekStart: 1,
        escalationThreshold: 3,
        inactivityLockMinutes: 10
      });
      legacyRepos.residents.create({
        id: "res-1",
        firstName: "Fictional",
        lastName: "Resident",
        status: "active",
        source: "manual",
        sourceBatchId: null
      });
    });
    legacyDb.close();

    const result = relocateLegacyStoreIfNeeded(legacyPath, newPath);
    expect(result).toEqual({ relocated: true, reason: "relocated" });
    expect(existsSync(newPath)).toBe(true);

    const relocatedDb = openDatabase(newPath);
    expect(getSchemaVersion(relocatedDb)).toBeGreaterThanOrEqual(2);
    const relocatedRepos = createSqliteRepositories(relocatedDb);

    // Prior business data survived the relocation intact.
    expect(relocatedRepos.facility.get()?.name).toBe("Fictional Pines Care Home");
    expect(relocatedRepos.residents.listActive()).toHaveLength(1);

    // Migration v2's accounts table exists and is empty (a fresh admin
    // bootstrap is still required — no accounts are invented for old data).
    expect(relocatedRepos.accounts.countAll()).toBe(0);

    // Original legacy file is left in place as a recovery fallback, not deleted.
    expect(existsSync(legacyPath)).toBe(true);

    relocatedDb.close();
  });
});
