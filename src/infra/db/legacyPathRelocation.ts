import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * The Phase 0 -> Phase 1 development builds of this app (commit a4966c0)
 * opened SQLite at `<userData>/tasksheet.sqlite3`. The authoritative
 * docs/adr/ADR-0001-production-persistence-boundary.md path is
 * `<userData>/data/tasksheet.sqlite`. Nothing has ever been packaged or
 * distributed from this repository, so there is no real end-user
 * installation to migrate — but the rule "never silently initialize an
 * empty database over an existing installation" applies regardless of who
 * asks it, so this check runs unconditionally at startup rather than being
 * left as a documented risk.
 *
 * If a legacy-path store exists and the new-path store does not, this
 * copies the database file together with its WAL/SHM sidecars (all three,
 * so no committed-but-unchecked-pointed WAL frames are separated from
 * their database) to the new location *before* anything opens either
 * file. This is safe specifically because it runs pre-open, with no live
 * connection to either path: SQLite's own recovery on the next `openDatabase`
 * call replays/checkpoints the WAL exactly as it would have at the old
 * path. The legacy files are left in place (copy, not move) as a
 * recovery fallback; they are not deleted by this function.
 *
 * Schema migrations then run in `openDatabase` as normal — this is a
 * *path* relocation, not a schema migration. The legacy database was
 * always schema version 1 (no accounts tables yet); migration v2 applies
 * cleanly on top of the relocated file the same way it would on a
 * continuously-used one.
 */
export interface RelocationResult {
  relocated: boolean;
  reason: "no-legacy-store" | "already-migrated" | "relocated";
}

export function relocateLegacyStoreIfNeeded(legacyPath: string, newPath: string): RelocationResult {
  if (existsSync(newPath)) {
    return { relocated: false, reason: "already-migrated" };
  }
  if (!existsSync(legacyPath)) {
    return { relocated: false, reason: "no-legacy-store" };
  }

  mkdirSync(dirname(newPath), { recursive: true });
  copyFileSync(legacyPath, newPath);
  for (const suffix of ["-wal", "-shm"]) {
    const legacySidecar = legacyPath + suffix;
    if (existsSync(legacySidecar)) {
      copyFileSync(legacySidecar, newPath + suffix);
    }
  }
  return { relocated: true, reason: "relocated" };
}
