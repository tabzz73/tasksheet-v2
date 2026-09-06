import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./migrations.js";

/**
 * Opens (creating if necessary) the SQLite store and applies any pending
 * migrations. `filePath` is the caller's concern — the main process passes
 * `path.join(app.getPath("userData"), "data", "tasksheet.sqlite")` per
 * docs/adr/ADR-0001-production-persistence-boundary.md; tests pass a temp
 * file or ":memory:".
 */
export function openDatabase(filePath: string): Database.Database {
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = FULL");
  runMigrations(db);
  return db;
}
