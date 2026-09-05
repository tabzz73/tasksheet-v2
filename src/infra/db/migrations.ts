import type Database from "better-sqlite3";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * Ordered, numbered, transactional migrations (ARCHITECTURE-ESSENTIALS.md
 * §3.1/§8). Each migration is applied at most once, inside a transaction,
 * and `meta.schema_version` is only advanced after a successful commit —
 * re-running is a safe no-op.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "initial schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE facility_settings (
          facility_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          address_line1 TEXT NOT NULL,
          address_line2 TEXT,
          main_phone TEXT NOT NULL,
          nursing_phone TEXT,
          fax TEXT,
          time_zone TEXT NOT NULL,
          week_start INTEGER NOT NULL CHECK (week_start IN (1, 7)),
          escalation_threshold INTEGER NOT NULL DEFAULT 3
        );

        CREATE TABLE rooms (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          sort_key TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE beds (
          id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL REFERENCES rooms(id),
          label TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          UNIQUE (room_id, label)
        );

        CREATE TABLE residents (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active','in_hospital','out_on_pass','moved_out','deceased')),
          source TEXT NOT NULL CHECK (source IN ('manual','demo','imported')),
          source_batch_id TEXT
        );

        CREATE TABLE placements (
          id TEXT PRIMARY KEY,
          resident_id TEXT NOT NULL REFERENCES residents(id),
          bed_id TEXT NOT NULL REFERENCES beds(id),
          start_date TEXT NOT NULL,
          end_date TEXT
        );

        -- At most one current (end_date IS NULL) placement per resident and per bed.
        CREATE UNIQUE INDEX idx_placement_current_resident
          ON placements(resident_id) WHERE end_date IS NULL;
        CREATE UNIQUE INDEX idx_placement_current_bed
          ON placements(bed_id) WHERE end_date IS NULL;

        CREATE TABLE shifts (
          id TEXT PRIMARY KEY,
          short_code TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('HCA','LPN')),
          start_minutes INTEGER NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
          end_minutes INTEGER NOT NULL CHECK (end_minutes BETWEEN 0 AND 1439),
          active INTEGER NOT NULL DEFAULT 1,
          display_order INTEGER NOT NULL DEFAULT 0
        );

        -- Unique short code among active shifts only (PRD §10.2).
        CREATE UNIQUE INDEX idx_shift_active_short_code
          ON shifts(short_code) WHERE active = 1;

        CREATE TABLE catalog_items (
          id TEXT PRIMARY KEY,
          version INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          instructions TEXT NOT NULL DEFAULT '',
          active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE resident_tasks (
          id TEXT PRIMARY KEY,
          resident_id TEXT NOT NULL REFERENCES residents(id),
          role TEXT NOT NULL CHECK (role IN ('HCA','LPN')),
          eligible_shift_ids TEXT NOT NULL, -- JSON array of shift ids
          schedule_json TEXT NOT NULL,      -- Schedule (cadence + placement)
          schedule_revision INTEGER NOT NULL DEFAULT 1,
          active_from TEXT NOT NULL,
          active_to TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id),
          catalog_version INTEGER NOT NULL,
          catalog_name TEXT NOT NULL,
          catalog_category TEXT NOT NULL,
          catalog_instructions TEXT NOT NULL,
          important_information TEXT,
          show_on_print INTEGER NOT NULL DEFAULT 1,
          source TEXT NOT NULL CHECK (source IN ('manual','demo','imported')),
          source_batch_id TEXT
        );

        CREATE TABLE generation_events (
          id TEXT PRIMARY KEY,
          document_kind TEXT NOT NULL,
          assignment_date TEXT NOT NULL,
          shift_id TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          source_dataset_revision INTEGER NOT NULL
        );

        INSERT INTO meta (key, value) VALUES ('schema_version', '0');
        INSERT INTO meta (key, value) VALUES ('dataset_revision', '0');
      `);
    }
  }
];

export function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

export function runMigrations(db: Database.Database): void {
  const hasMeta = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'")
    .get();
  const currentVersion = hasMeta ? getSchemaVersion(db) : 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
        String(migration.version)
      );
    });
    apply();
  }
}

/** Monotonically increasing dataset revision, bumped by every committed mutation. */
export function bumpDatasetRevision(db: Database.Database): number {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('dataset_revision', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)"
  ).run();
  const row = db.prepare("SELECT value FROM meta WHERE key = 'dataset_revision'").get() as { value: string };
  return Number(row.value);
}

export function currentDatasetRevision(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'dataset_revision'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}
