import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

/**
 * Opens (creating if necessary) the SQLite store and applies any pending
 * migrations. `filePath` is the caller's concern — the main process passes
 * `path.join(app.getPath("userData"), "tasksheet.sqlite3")" per ADR-0001;
 * tests pass a temp file or ":memory:".
 */
export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
