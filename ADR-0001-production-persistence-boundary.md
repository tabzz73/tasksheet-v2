# ADR-0001 — SQLite production persistence

Status: Adopted implementation baseline; implementation and migration verification pending.
Date: 2026-09-05
Authority: subordinate to PRD and architecture documents. Added under the user's request to complete implementation guidance. No existing installation has been migrated by this documentation change.

## Context and decision

TaskSheet needs related resident, placement, schedule, occurrence, provenance, and configuration records with recoverable mutations. Select SQLite in `app.getPath("userData")/data/tasksheet.sqlite`, owned by the Electron main process. This is one workstation's database, not a shared network database. The renderer uses allow-listed application commands and typed queries through preload IPC; it receives no database connection, SQL, or arbitrary file operations.

Use foreign-key enforcement on every connection, WAL journaling, `synchronous=FULL`, and bounded lock waits with actionable errors. Serialize application writes. Use transaction-scoped repositories and a single application instance. Commit related changes together, including command deduplication and revision updates. Never claim immunity from disk failure or hardware that fails to honor durability requests.

Select and pin the Electron-compatible SQLite binding during phase 0, based on actual Windows packaging and backup tests; this driver choice does not reopen the SQLite engine decision. Do not invent an installed runtime version or reuse another project's package versions.

## Alternatives

| Option | Disposition |
| --- | --- |
| Main-process versioned JSON | Simpler early setup, but whole-dataset writes and relational invariants need more custom machinery; retained as logical exchange format only |
| SQLite | Selected for transactional relationships, constraints, and structured queries |
| Renderer localStorage | Legacy migration input or isolated tests only; prohibited production authority |
| Shared/network/cloud database | Outside V2 scope |

## Schema and transaction rules

Use stable IDs and indexed foreign keys. Store migration version/checksum records, dataset revision, and an installation migration marker. Apply one explicit schema step at a time. Reject a database created by an unsupported future schema version; never initialize over an unrecognized or corrupt store. Inspect integrity and domain invariants before accepting a migrated store.

Use optimistic revisions for stale forms and a unique command ID for retry safety. A failed command must not partially update placements, wound-linked schedules, follow-up states, or provenance.

## Backup format and compatibility

Full backup format: `.tasksheet-backup`, a ZIP containing `manifest.json` and `data.sqlite`. Manifest fields: product `TaskSheet`, formatVersion `1`, schemaVersion, appVersion, exportedAt UTC, datasetRevision, per-table recordCounts, and SHA-256 for `data.sqlite`. Do not include OS usernames, original absolute paths or employee profiles. Under ADR-0002 the native data.sqlite snapshot includes minimal local account verifiers/grants/security audit and is sensitive and Administrator-only; these are excluded from logical exports. A checksum detects accidental alteration; it is not authentication or encryption.

Create a consistent SQLite snapshot through the binding's Online Backup API, close and validate the destination, then package it. Do not copy a live database file alone: committed content can reside in WAL sidecars. Verify integrity, foreign keys, manifest counts and checksum before success. Backups may be saved to a user-selected external location as inactive copies.

CSV, Excel `.xlsx`, and JSON logical exchange for the whole database and both separate catalogs is defined in `../../DATA-EXCHANGE.md`. Whole-database logical import rebuilds a validated candidate SQLite database; catalog imports use scoped transactions. The native `.tasksheet-backup` remains the exact SQLite snapshot recovery format. Legacy versioned JSON is supported only through an explicit importer for recognized schemas; unknown layouts are rejected without changes.

## Legacy migration and rollback

1. Detect the actual legacy schema and inventory its keys; do not assume prior documentation proves the on-disk format.
2. Preserve a recoverable source snapshot. Validate records and preview exclusions, including prohibited staff fields. Do not silently discard or republish those fields; surface counts without identity values and require review of the sanitized candidate.
3. Build a new candidate SQLite database. Preserve IDs, dates, catalog snapshots, provenance, and references. Ambiguous legacy follow-up occurrence dates become migration issues requiring resolution, not guessed dates.
4. Validate the candidate and mark its source fingerprint in the same completed migration state.
5. Close handles, activate the candidate using a recoverable file-switch sequence, reopen and verify it, then record completion. Interrupted activation must recover deterministically to the old or validated new store, never an empty dataset.
6. Keep the source isolated for rollback; never run old and new versions as concurrent authorities. Rolling back to a pre-migration snapshot loses subsequent V2 changes unless separately exported and reconciled; state this before rollback.

For restore, validate ZIP entries against path traversal and size limits, checksum and schema before activation. Freeze writes, create a pre-restore backup, close SQLite connections, and activate the validated candidate without mixing old WAL/SHM files into the new database. Retain a recovery marker and old store until reopening succeeds. A stale restore preview is invalidated by any intervening data change.

## Security and diagnostics

No employee profile domain. ADR-0002 permits minimal local accounts/security tables with offline authentication and authorization. Native backups carry those tables; normal restore preserves receiving security policy and fresh-machine recovery authenticates against the backup before activation. Actual paths appear only in explicit local transient diagnostics. SQLite/native backup do not imply encryption at rest or regulatory certification, and specified authentication is not claimed implemented until verified.

## Required evidence

- Packaged Windows read/write and restart with renderer storage cleared.
- Rejected malformed IPC, stale revision and duplicate command behavior.
- Interrupted transaction and interrupted migration/restore activation recovery.
- Backup while WAL has committed data; restore yields matching logical records.
- Unknown schema, corrupted payload, traversal ZIP and checksum failures leave active data unchanged.
- Uninstall/reinstall retention, Windows-user separation, offline launch and privacy-safe diagnostics.

## Technical references

SQLite's [Online Backup API](https://www.sqlite.org/backup.html) provides consistent live-database snapshots. SQLite's [WAL documentation](https://www.sqlite.org/wal.html) describes sidecar files, checkpointing, durability settings, and same-host restrictions. These support this design; the application still requires packaged failure/recovery verification.
