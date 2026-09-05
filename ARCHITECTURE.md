# TaskSheet V2 — Software Architecture

**Status:** Implementation blueprint  
**Owner:** SoftVibeSolutions  
**Version:** 2.0-draft  
**Last updated:** 2026-09-05  

## 1. Purpose

This document explains how to implement TaskSheet V2 while preserving the product rules in `PRD.md` and the non-negotiable constraints in `ARCHITECTURE-ESSENTIALS.md`.

It is descriptive where the current desktop implementation is known and prescriptive where V2 needs a durable boundary. If code and this document disagree, first determine whether the code is defective, the architecture changed intentionally, or the documentation is stale. Do not silently normalize the mismatch.

### 1.1 Authority

The canonical order is `PRD.md` → `ARCHITECTURE-ESSENTIALS.md` → `ARCHITECTURE.md` → approved ADRs → `AGENTS.md` → tool-specific instructions including `CLAUDE.md` → tests and implementation. An ADR is limited by the documents above it.

## 2. System context

TaskSheet runs as a Windows desktop application on one facility workstation. Core workflows remain available offline. The operating system provides the application data directory, printing subsystem, file dialogs, and installer lifecycle. External care systems remain authoritative and are not directly synchronized in V2.

### 2.1 Primary actors

- Administrator / supervisor
- Charge nurse
- LPN/RN
- HCA
- Windows workstation and printer
- Inactive backup/export file selected by an authorized user

### 2.2 Trust boundaries

- Renderer UI
- Desktop main process and privileged OS capabilities
- Local application data store
- User-selected import/export files
- Print spooler and physical paper

## 3. Recommended technology baseline

The V2 desktop baseline is:

- Electron desktop shell
- React + TypeScript UI
- Tailwind/design-token styling
- Typed, narrow preload IPC
- Versioned main-process-owned local persistence behind repository interfaces and typed preload IPC
- Vitest or equivalent for unit/component tests
- Playwright for packaged or production-like end-to-end tests
- Windows `.exe` setup installer

The persistence interface must not expose storage-engine details to domain or UI code. Packaged V2 production uses SQLite under the OS-provided Electron application-data directory, owned by the main process. `docs/adr/ADR-0001-production-persistence-boundary.md` records transactions, backup compatibility, migration, and rollback. Browser-backed local storage is not a production persistence engine. `DATA-CONTRACTS.md` supplies the implementation contracts delegated by this architecture; `UI-UX-SPEC.md` and `IMPLEMENTATION-PLAN.md` supply presentation and delivery guidance subordinate to their controlling documents.

## 4. Runtime topology

The Electron main process owns:

- Application lifecycle
- Secure window creation
- File system access
- Import/export/backup operations
- Print coordination that requires OS privileges
- Diagnostics and application paths
- The authoritative production persistence adapter and all production data reads/writes

The preload bridge exposes only allow-listed typed commands. The renderer owns UI composition and calls application use cases through the bridge or an in-process application boundary, depending on the deployment module.

The bridge exposes use-case operations—not raw paths, arbitrary file access, unrestricted database queries, or a generic key/value API. Every privileged request and response is schema-validated. Browser-backed storage is limited to isolated UI development, automated tests, and controlled legacy migration; it must remain empty or non-authoritative in packaged production.

Security defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- No unrestricted IPC passthrough
- Validate IPC payloads on the privileged side
- Deny arbitrary filesystem paths unless selected through an approved dialog or validated application-owned path
- Use a restrictive content security policy compatible with packaged operation

## 5. Layered design

### 5.1 Domain layer

Pure TypeScript with no React, Electron, browser storage, or filesystem dependencies. It owns:

- Entity/value-object validation
- Shift-window calculation
- Scheduling and recurrence
- Active/effective-date rules
- Occupancy constraints
- Follow-up transitions
- Catalog snapshots
- Natural ordering keys
- Workload semantics
- Report inclusion rules that are genuinely domain-level

### 5.2 Application layer

Coordinates use cases and transactions:

- Create/update/deactivate resident
- Place or move resident
- Configure shift
- Assign resident or unit task
- Generate assignment-sheet model
- Build dashboard/huddle read models
- Change follow-up status
- Preview and commit import
- Export backup and restore
- Load/clear demo batch

Application services accept typed commands and return typed results. Expected validation failures are values, not uncaught exceptions.

### 5.3 Repository ports

Repository interfaces express domain needs, for example:

```ts
interface ResidentRepository {
  getById(id: ResidentId): Promise<Resident | null>;
  listCurrent(filter?: ResidentFilter): Promise<Resident[]>;
  save(resident: Resident): Promise<void>;
}

interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
```

Avoid one universal `db` object exposed throughout the UI. Where legacy code uses one, migrate behind context-specific services without risky all-at-once rewrites.

### 5.4 Infrastructure adapters

Adapters implement:

- Local persistence
- Schema migration
- File import/export
- Backup creation/validation
- Electron IPC
- OS printing
- Clock and facility-timezone services
- Diagnostics

### 5.5 Presentation layer

React screens and reusable components own:

- Display state
- Form interaction and accessible validation
- Navigation
- Layout and design tokens
- Calling application use cases
- Rendering typed dashboard and document models

Presentation code does not calculate overnight windows, recurrence, follow-up escalation, or output eligibility.

## 6. Domain model

All persisted entities include stable IDs, timestamps where meaningful, and provenance when they may be imported or seeded.

### 6.1 Facility and settings

Key fields:

- Facility identity and print contacts
- IANA timezone
- Time display preference
- Week-start preference
- Overnight reporting basis
- Follow-up escalation threshold
- Bathing capacity default
- Print defaults and calibration metadata
- Optional structured Code of the Month configuration

```ts
type CodeOfTheMonth = {
  code: string;
  title: string;
  summary?: string;
  effectiveMonth: YearMonth;
  enabled: boolean;
  updatedAt: Instant;
};

interface FacilitySettings {
  // Other approved facility configuration fields.
  codeOfTheMonth?: CodeOfTheMonth;
}
```

Dashboard and Huddle read models include this item only when it is enabled and matches the requested effective month. Missing, disabled, or expired configuration yields an explicit configured-empty state. It is educational/operational content, not an emergency-procedure authority.

### 6.2 Physical placement

Model the hierarchy as configurable rather than assuming all layers exist:

- Facility
- Optional Building
- Optional Wing
- Optional Floor
- Room
- Bed/space
- Resident Placement

Store a human-facing `roomLabel` and a stable natural-sort key. Placement changes should be transactional and retain history when required.

### 6.3 Shift and assignment line

A shift contains role, label/code, start/end local time, active state, and ordering. If the product later separates reusable time windows from assignment lines, preserve compatibility through explicit IDs and migration—not inferred code parsing.

### 6.4 Task catalog and assignment snapshot

Catalog entries are mutable definitions. Assigned tasks retain snapshots of print-critical fields such as name, credential role, required staff, duration, modifier effects, and instructions. The assignment references the source catalog version for traceability.

### 6.5 Wounds and wound-related tasks

The Wounds bounded context owns wound identity, resident association, anatomical location/site, stage/classification, status, opened/healed dates, and healing history. Resident Tasks own generic reminder wording, role, schedule, shift applicability, and print instructions.

A Resident Task may reference a wound through a stable link:

```ts
type WoundTaskLink = {
  woundId: WoundId;
  residentTaskId: ResidentTaskId;
  relationship: "assessment" | "dressing" | "monitoring" | "other";
};
```

Resident Tasks do not copy the wound registry or own wound status. Application read-model builders combine the contexts through typed queries. Healing/inactivation transactionally suppresses linked occurrences from the effective timestamp and closes open follow-ups as `no_longer_needed` with reason `wound_inactive`. Terminal history is preserved. Reactivation requires explicit linked-schedule review and does not revive old follow-ups. UI components never perform ad hoc joins or infer status from copied text.

### 6.6 Scheduling

Use the canonical cadence-plus-placement contract in `DATA-CONTRACTS.md`. This permits interval/month-day tasks to carry explicit times without competing recurrence implementations:

```ts
type TaskSchedule = { cadence: Cadence; placement: Placement };
```

Effective start/end dates wrap the schedule. Scheduling functions return occurrences; UI filters do not recreate recurrence logic.

### 6.7 Operational visibility

FYIs, attention items, selected resident tasks, and future approved announcement types may implement the shared `OperationalVisibility` value object. Read-model builders resolve priority, effective dates, and target surface.

### 6.8 Follow-up

Follow-up transitions use the occurrence-level command in `DATA-CONTRACTS.md`, including command ID and expected revision. The transaction validates current state, preserves due date, increments carry-forward once per distinct command, and records an identity-free operational event. It never changes a recurring template’s completion state or asserts clinical completion.

## 7. Time and date handling

Use explicit types for:

- `LocalDate` (`YYYY-MM-DD`)
- `LocalTime` (validated canonical minutes or `HH:mm` internally)
- Facility timezone (IANA identifier)
- Instant/timestamp for audit metadata

Formatting as `HHmm` is a display decision. Never compare formatted time strings unless the canonical format and validation make lexical ordering safe and the comparison is isolated/tested.

For each assignment date, construct a facility-local half-open shift interval. Resolve overnight end on the next local calendar day. Daylight-saving transitions must use timezone-aware operations rather than fixed 24-hour arithmetic.

## 8. Persistence and schema evolution

### 8.1 Store contract

The logical export/legacy-import envelope contains the following metadata. Production SQLite uses normalized tables plus a schema-migration ledger; this envelope is not a renderer-owned live database:

```ts
type PersistedEnvelope = {
  schemaVersion: number;
  appVersion: string;
  facilityId: string | null;
  data: PersistedData;
  integrity?: IntegrityMetadata;
};
```

### 8.2 Atomic writes

The SQLite adapter validates each command and performs all related row changes and revision updates in one transaction. Success is returned only after commit. Failures roll back and preserve the last committed state. Candidate files are used for validated backups/restores, not routine record saves. See ADR-0001 for WAL handling and recovery.

For V2 packaged production, the Electron main process owns the authoritative store in the OS application-data directory, and renderer access occurs only through typed, validated preload IPC. Browser-backed local storage may exist only in isolated development/testing or as a read-once legacy migration source; it is never authoritative production storage. Direct component-level persistence writes are prohibited.

Internal privileged backup/import port (never expose full-store load/save directly through IPC):

```ts
interface TaskSheetPersistencePort {
  load(): Promise<PersistedEnvelope>;
  save(command: SaveEnvelopeCommand): Promise<SaveResult>;
  createBackup(request: BackupRequest): Promise<BackupResult>;
  previewRestore(fileToken: ApprovedFileToken): Promise<RestorePreview>;
  commitRestore(previewToken: RestorePreviewToken): Promise<RestoreResult>;
}
```

If legacy renderer data exists, migration detects and validates it without mutation, creates a recoverable backup, atomically imports it, verifies counts/schema/provenance/integrity, and marks completion only after verification. Migration is idempotent and retains a documented rollback path.

### 8.3 Migrations

- One migration per version step.
- No downgrade without an explicit supported path.
- Create a recoverable pre-migration backup.
- Validate after each step.
- Abort safely on unknown future schema versions.
- Test migrations using representative prior-version fixtures.

## 9. Import, export, and backup

Use a versioned manifest with product identity, schema version, export timestamp, source application version, dataset scope, and checksum where applicable.

Import is two-phase:

1. **Preview:** parse, validate, show counts/conflicts/provenance, and make no changes.
2. **Commit:** execute one transaction or atomic state replacement after confirmation.

Separate catalog exchange from full operational backup. Never treat a network-located export as the live database.

### 9.1 Logical exchange formats and catalog ownership

`DATA-EXCHANGE.md` is the delegated normative contract for CSV/Excel/JSON imports and exports of Whole Database, Wound Care Supplies Catalog and Care Tasks Catalog. Format adapters decode into one canonical typed exchange model and share validation, preview and commit services; they do not implement independent domain rules. Exports read one consistent database snapshot, not paginated UI rows. Heavy parsing runs in a bounded main-process-owned worker where needed, without granting the renderer file/SQL access.

The Wound Care Supplies Catalog owns reusable supply products independently of the Wounds resident registry. Wounds may reference a supply ID and snapshot its display-critical fields; catalog updates do not rewrite wound history. No inventory or procurement subsystem is implied. Care Tasks Catalog owns task and modifier definitions; assignments retain their existing snapshots.

Whole-database logical import validates relationships and builds a candidate SQLite database, then uses ADR-0001's backed-up activation/recovery sequence. Catalog imports execute a scope-limited transaction with revision/command checks. Preview tokens bind file fingerprint, format/schema, scope, chosen conflict resolutions and active dataset revision; any change invalidates confirmation. Malformed input, cancel or failed commit leaves the current dataset unchanged.

## 10. Query and read-model architecture

Complex surfaces receive purpose-built immutable read models:

- `DashboardViewModel`
- `HuddleViewModel`
- `ShiftWorkspaceViewModel`
- `HcaTaskSheetDocument`
- `LpnTaskSheetDocument`
- `FyiBinderDocument`
- `BathingGridDocument`
- `WoundScheduleDocument`
- `HuddleDocument`
- `Lookahead7DayDocument`
- `ShiftConfigReferenceDocument`
- `BlankTaskSheetTemplateDocument`
- `PrinterCalibrationDocument`
- `CustomReportDocument`
- `PrintPackageDocumentSet`

Each builder takes an explicit facility, assignment date, shift/report parameters, and clock when needed. It returns validation warnings alongside data so missing or excluded information is explainable.

Every PRD-required Print Center output maps to one named immutable document model or to `PrintPackageDocumentSet`, which composes already-built immutable child documents without bypassing their eligibility rules. `PrinterCalibrationDocument` is synthetic and queries no resident data. `BlankTaskSheetTemplateDocument` contains headings and handwriting rows but no resident data. Custom reports remain subject to privacy, active-status, provenance, role, and date filters.

### 10.1 Bathing generation request

The UI collects and validates bathing inputs before builder invocation:

```ts
type BathingAssignmentGenerationRequest = {
  facilityId: FacilityId;
  weekStart: LocalDate;
  requirements: ReadonlyArray<{ residentId: ResidentId; showersPerWeek: number }>;
  capacitySlots: ReadonlyArray<{ date: LocalDate; shiftId: ShiftId; capacity: number }>;
  lockedAssignments?: BathingAssignmentLock[];
};
```

A facility default may prefill a value, but the submitted request is explicit. The builder never opens UI, reads mutable UI state or storage, or asks a question. Equal source state and equal request values produce equal output.

`DATA-CONTRACTS.md` defines allocation order, individual requirements, lock validation and unmet-demand behavior. Source records are loaded before calling the pure builder. The application use case may query repositories; the builder itself receives a snapshot and performs no I/O. Synthetic calibration/blank documents skip resident queries entirely.

## 11. Printing architecture

### 11.1 One document model

Preview and print render from the same immutable document model. Do not run new eligibility queries inside print components.

### 11.2 Print shell

A common print shell owns:

- Facility header
- Document title and context
- Approved notice
- Page margins and orientation
- Repeating header/footer rules
- Generated timestamp
- Print-only CSS reset and monochrome behavior

Document types may choose portrait/landscape and density, but they must reuse typography, spacing, borders, and footer tokens.

The common pipeline applies to primary, specialized, custom, synthetic, and package outputs. Every document type must maintain preview/print parity.

### 11.3 Pagination

Use semantic tables where output is tabular. Avoid row splitting where supported, repeat `thead`, and test long resident/task/instruction values. CSS page counters may be used when the target Electron/Chromium build prints them reliably; otherwise use an approved header/footer mechanism.

## 12. UI architecture

### 12.1 Navigation

Use route definitions as a single typed registry for sidebar labels, icons, permissions, breadcrumbs, and route tests. Avoid scattered path literals.

### 12.2 Design system

Prefer semantic tokens such as:

- `bg-panel`
- `text-ink`
- `border-hairline`
- `accent`
- `positive`
- `warning`
- `danger`

Reusable primitives own focus, disabled, loading, selected, and error behavior. Feature components should not create independent color systems.

### 12.3 Interactive rows

For list rows with secondary actions, use a non-interactive container, a sibling navigation control/overlay, and separate action buttons. Preserve keyboard Enter/Space behavior and visible focus without nesting buttons.

### 12.4 Responsive behavior

Desktop layout uses the categorized left navigation. Narrow layouts prioritize current context, search, print actions, and touch-friendly controls. Responsive changes must not hide required information without an accessible alternative.

## 13. Error handling and diagnostics

### 13.1 Editor and attention presentation contracts

Share `ContextAwareEditor`, `DirtyExitGuard` and `AttentionDialog` behavior across task, resident, FYI, wound, shift, settings and report editors; names describe responsibilities rather than mandating an existing component API. The editor tracks a baseline and normalized draft, visible sections, active step, touched fields, validation and save state. Dirty means a semantic difference from the baseline; reverting edits clears it. Context prefill is visible and never silently selects an arbitrary resident.

Changing steps preserves draft data and never saves implicitly. Fields made inapplicable by a role/task-type change are excluded from submission; if previously entered data would be cleared, explain the consequence in a centered confirmation. Dynamic required fields are validated before leaving the relevant step and again before commit. Validation returns field/step paths plus typed errors; domain and persistence layers do not open dialogs.

One presentation coordinator maps typed results to field hints, success status or a centered attention dialog. Queue/coalesce duplicate failures rather than stacking alerts. Important submission errors, storage failures, stale revisions, destructive warnings and dirty-exit decisions never render as form-embedded warning panels. Temporarily suspend the editor's focus trap and make it inert; the attention dialog alone is accessible/interactive. Restore the draft, active step and appropriate focus when it closes. Persist no sensitive draft solely to implement this behavior; use the existing explicit draft-save policy if one is approved.

Guard all editor exit paths, including Electron window-close requests through a narrow dirty-state handshake. A normal close with dirty state is held while the renderer resolves the dialog; a lost/unresponsive renderer is not permission to claim drafts were saved. Forced OS termination cannot be guaranteed by a confirmation guard. During save, prevent duplicate submissions and queue normal exit until the result is known; do not display a discard confirmation that pretends it cancels a committed transaction.

Print Center/Settings routes encode active category and safe filter state; use a single category panel rather than mounting every form/card. Paged/virtualized collection views request data through view-model queries. The print/export service queries the entire requested scope independently of the currently rendered rows. Print CSS hides the entire overlay/navigation layer and uses the shared low-ink print tokens.

### 13.2 Failure classification

Classify failures:

- Validation: actionable field-level message
- Domain conflict: explain the rule and preserve input
- Persistence: stop, preserve last valid state, offer retry/recovery guidance
- Import: reject without partial commit and show a safe summary
- Print: retain preview and explain printer/browser action
- Unexpected: show a stable incident code and write privacy-safe diagnostics

Diagnostics may include app version, schema version, platform, Electron/Chromium versions, redacted application-data path, and error codes. A user-requested local-only view may resolve the actual path transiently. Copied support text, logs, exports, and bundles replace the user-data root with `<USER_DATA>` and other user-selected absolute paths with `<EXTERNAL_PATH>`. Do not persist OS usernames or resident content in support diagnostics.

## 14. Security design

- Treat the renderer as less privileged than the main process.
- Validate all privileged commands with schemas.
- Avoid shell execution and arbitrary URL navigation.
- Restrict external links and open them only through a reviewed handler.
- Keep dependencies current through reviewed upgrades and lockfiles.
- Never embed secrets in renderer bundles.
- Redact sensitive values from logs and crash reports.
- Require explicit confirmation for clear/reset/restore operations.
- Do not define or persist a Staff/Employee entity in V2. Do not store names, initials, employee numbers, usernames, contacts, staff schedules, attendance, payroll, credentials, performance, completion statistics, or persistent prepared/assigned/completed-by identities.
- Do not copy the operating-system account name into application data, exports, printouts, or ordinary diagnostics. Use role, shift, assignment-line code, and area only.

## 15. Testing strategy

### 15.1 Unit tests

Pure domain functions: shift windows, recurrence, date ranges, occupancy, sorting, follow-up, snapshots, inclusion rules.

### 15.2 Application tests

Use-case orchestration with repository fakes: transactional behavior, demo cleanup, import preview/commit, view-model construction, and error mapping.

### 15.3 Adapter tests

Persistence round trips, migrations, corruption behavior, backup manifests, path handling, and IPC validation.

Packaged persistence tests must prove that browser storage is empty or non-authoritative, main-process storage survives restart, malformed IPC is rejected, interrupted saves retain a valid state, and legacy migration is idempotent and recoverable.

### 15.4 Component/accessibility tests

Forms, smart search, empty/loading/error states, dashboard customization, menus, keyboard operation, and interactive-row contracts.

### 15.5 End-to-end tests

Run against production-like builds and cover first run, clean/demo paths, resident/task configuration, overnight printing, batch printing, backup/restore, navigation, and restart persistence.

### 15.6 Physical certification

Automated snapshots do not replace physical print checks. Certify representative outputs at Actual Size/100% with recorded printer/driver settings.

## 16. Build and release

The release pipeline should:

1. Install from lockfile.
2. Run formatting/lint/type checks.
3. Run unit, application, adapter, component, and E2E tests.
4. Build the renderer and Electron application.
5. Package the Windows installer.
6. Generate checksums and software/version metadata.
7. Validate on a clean Windows user profile/machine.
8. Complete print and backup evidence.
9. Tag only the verified immutable source/artifact set.

Do not label a build production-ready while a P1/P0 blocker, unverified data migration, demo ambiguity, or required print certification remains open.

## 17. ADR process

Store decisions in `docs/adr/NNNN-short-title.md` with:

- Status
- Context and conflict
- Decision
- Alternatives considered
- Consequences
- Migration and rollback
- Documents/tests affected

An ADR may clarify implementation within the approved product. It cannot override `PRD.md` or `ARCHITECTURE-ESSENTIALS.md`; those documents must be amended explicitly when product or essential architecture changes.

## 18. Known evolution boundaries

The following are intentionally deferred and require explicit future decisions:

- Multi-workstation synchronization
- Multi-facility tenancy
- Cloud accounts and remote backup
- Direct EHR/eMAR integration
- Licensing enforcement
- Digital care completion/charting
- Mobile companion synchronization
