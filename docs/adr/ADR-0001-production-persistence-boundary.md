# 0001 — Production persistence boundary

Status: Accepted
Date: 2026-09-05

## Context

`PRD.md` §20 and `ARCHITECTURE-ESSENTIALS.md` §3.1 already require that production TaskSheet V2 data live in a single local, main-process-owned SQLite store under the OS-provided Electron application-data directory (`app.getPath("userData")`), reached from the renderer only through narrow typed/validated preload IPC use cases. This document had not yet been written down as an ADR despite being referenced by name from `PRD.md`, `ARCHITECTURE-ESSENTIALS.md`, `AGENTS.md` and `IMPLEMENTATION-PLAN.md`. This ADR records that already-controlling decision and the concrete binding/runtime choice needed to implement it, so the reference resolves to a real, versioned decision instead of a missing file.

Phase 0 inspection of this repository found no prior application code, package manifest, or persistence implementation — the repository previously contained only the specification suite. There is therefore no existing storage engine, schema, or release to migrate away from; this ADR selects the initial production engine rather than replacing one.

## Decision

- Production engine: SQLite, accessed from the Electron **main process only**, via the `better-sqlite3` synchronous native binding.
- Location: `path.join(app.getPath("userData"), "tasksheet.sqlite3")`, created on first run.
- The renderer never opens the database file, never receives a raw file-system path, and never gets a generic key-value or query bridge. It calls narrow, named, validated IPC use cases (e.g. `facility:save`, `shift:create`, `resident:place`, `assignment:generate`) exposed through a `contextBridge` preload script with Node integration disabled in the renderer.
- Every table carries a `schema_version` row in a dedicated `meta` table; migrations are ordered, numbered SQL/TS modules applied inside a transaction, one version at a time, and are re-run-safe (idempotent no-op when already applied).
- Mutations that touch more than one row/table run inside a single `db.transaction(...)`; a save is atomic from the user's perspective — either fully committed or fully rolled back.
- Backups are explicit snapshot exports (SQLite online backup API / `VACUUM INTO`), never a raw copy of the live file while WAL may be mid-write, and never a live sync target.
- For local development and unit/integration tests, the same `better-sqlite3` engine runs directly under Node (no Electron required) against a temp-file or in-memory database. Browser/renderer `localStorage` is never used to hold production records; where referenced at all, it is limited to non-authoritative, isolated UI-only state (e.g. a "which nav item was open" convenience) or controlled legacy-data migration input, per Architecture Essentials §3.1.

## Alternatives considered

- **Renderer-owned SQLite (e.g. `sql.js` in the browser context, persisted to `localStorage`/IndexedDB):** rejected — `ARCHITECTURE-ESSENTIALS.md` §3.1 explicitly prohibits renderer/browser storage as the authoritative production store.
- **`node:sqlite` (Node's built-in SQLite, stable since Node 22):** considered because it needs no native rebuild step. Rejected for this repository's pinned Electron target because Electron's bundled Node/V8 version lags the host Node used for tooling, so `node:sqlite`'s availability and API stability inside the packaged Electron main process cannot yet be confirmed against the actual pinned Electron release; `better-sqlite3` has a mature `electron-rebuild`/prebuild path. This choice should be revisited once an exact Electron version is pinned and packaged for Windows.
- **`sqlite3` (async node-sqlite3):** rejected — asynchronous callback/promise API adds complexity with no benefit for a single-workstation, single-connection desktop app; `better-sqlite3`'s synchronous API makes transactional use cases easier to keep correct.
- **A flat JSON/file-per-entity store:** rejected — cannot satisfy the transactional-mutation, atomic-save and relational-integrity requirements in `ARCHITECTURE-ESSENTIALS.md` §3.1 (e.g. one-current-placement-per-resident-and-bed).

## Consequences

- Native module: `better-sqlite3` must be rebuilt against the exact packaged Electron ABI before Windows packaging (`electron-rebuild` or prebuilt binaries). This is a pending packaging-time step, tracked as a phase 6 gate; it does not block phase 0/1 work run directly under Node.
- All schema changes must ship as new numbered migrations; hand-editing the schema of an existing database is prohibited.
- IPC surface must be enumerated and validated (this repository uses `zod` schemas per channel); adding a new persistence capability means adding a new named, validated use case, not widening an existing one.
- Because there was no prior implementation, there is no legacy schema to map in phase 0; legacy-migration mapping only applies if/when a pre-V2 data source is identified.

## Migration and rollback

- Forward: numbered migrations in `electron/db/migrations/*.ts`, applied in order inside one transaction per migration, recorded in `meta.schema_version`.
- Rollback: because V2 has no prior shipped release, there is no "downgrade" path required yet; a failed migration leaves the previous file untouched (migrations run against a copy-on-write staging step described in the persistence module) and the applied-version row is only updated after a successful commit.
- Backup/restore: `Export Backup` performs `VACUUM INTO <path>`; `Restore Backup` validates the candidate file's `schema_version` and integrity (`PRAGMA integrity_check`) into a temp path before atomically replacing the active store, preserving the prior active store until the new one is verified.

## Tests and documents affected

- `tests/persistence/*` (round-trip save/restart, migration apply/idempotency, transactional atomicity).
- `ARCHITECTURE.md`, `IMPLEMENTATION-PLAN.md` phase 0/6 exit evidence.
- This ADR is the authoritative answer to the file path referenced throughout the higher-authority suite; it does not change or weaken any PRD/Architecture Essentials rule.
