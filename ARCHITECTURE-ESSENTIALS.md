# TaskSheet V2 — Architecture Essentials

**Status:** Normative engineering constraints  
**Authority:** Subordinate only to `PRD.md`  
**Last updated:** 2026-09-05  

This file is the short, non-negotiable architecture contract. Read it before `ARCHITECTURE.md` and before changing application behavior.

## 1. Product boundary

TaskSheet is a single-facility, single-workstation, offline-capable Windows desktop generator whose primary lifecycle is:

> **ORGANIZE → GENERATE → PRINT**

It is not an EHR, eMAR, clinical chart, legal care record, payroll system, staff surveillance tool, or real-time shared database.

## 2. Authority and conflicts

The authority order is:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. `ARCHITECTURE.md`
4. Approved ADRs
5. `AGENTS.md`
6. Tool-specific instructions, including `CLAUDE.md`
7. Tests and code

Never resolve a material conflict silently. Preserve the higher-authority rule and document the decision through an ADR or explicit documentation correction.

## 3. Hard invariants

### 3.1 Persistence

- One local application data store is authoritative for V2.
- The production engine is SQLite; see `docs/adr/ADR-0001-production-persistence-boundary.md`. Business mutations use transactions, not whole-file replacement on every save.
- In packaged production, that store resides in the OS-provided application-data directory and is owned by the Electron main process.
- Renderer/browser local storage is prohibited as the production authoritative store. It is allowed only for isolated development/testing or controlled legacy-data migration.
- The renderer reaches persistence only through narrow, typed, validated preload IPC use cases; it never receives generic file, key/value-store, or database capability.
- Core operation cannot depend on a network, cloud service, or remote account.
- All persisted state has a schema version.
- Migrations are explicit, ordered, tested, and never skipped.
- User-visible saves are atomic; interrupted writes must retain either the old valid state or the new valid state.
- Backup files are inactive snapshots, never live synchronization targets.
- Whole Database, Wound Care Supplies Catalog and Care Tasks Catalog each support import/export in CSV, Excel `.xlsx` and JSON. Scope, format and import mode are explicit and validated; catalog operations cannot mutate resident/facility records.
- Full CSV exchange is a multi-table ZIP; full Excel exchange is a multi-sheet workbook. All formats preserve logical relationships and pass round-trip validation; native SQLite backups remain distinct.
- Demo, imported, and manual provenance must survive save/export/restore.

### 3.2 Domain

- One resident has at most one current placement.
- One bed has at most one current resident.
- Shift short codes are unique among active shifts.
- `endTime <= startTime` means an overnight shift.
- Date/shift inclusion is calculated in the facility timezone and is deterministic.
- Resident selectors never auto-select the first result.
- Inactive residents, inactive tasks, healed wounds, and out-of-range records do not enter current sheets unless a report explicitly requests them.
- Standing FYIs do not affect task due/overdue counts.
- Carry-forward never resets the original follow-up due date.
- Follow-up state belongs to a distinct occurrence, never the recurring template. Commands are retry-safe and future occurrences have independent states.
- Catalog edits never silently mutate assignment snapshots.
- Detailed wound registry data is owned only by the Wounds context. Resident Tasks may hold generic wound reminders and stable wound references but never an independent wound registry or competing wound status.
- Healing/inactivation suppresses linked work from its effective timestamp and closes open linked follow-ups with `no_longer_needed`/`wound_inactive`; reactivation requires explicit task review.

### 3.3 Output

- Generation is a pure read-model operation: source data + configuration + date + shift + report options → deterministic document model.
- Preview and print use the same document model.
- Every HCA/LPN primary sheet contains the approved guide/source-of-truth notice.
- Multi-page tables repeat headers and identify page/document context.
- Printed resident identity defaults to first name, last name, and room only.
- HCA does not show a dedicated Vitals/Results column by default.
- Paper output defaults to white backgrounds, black text and thin rules; omit decorative ink, blank optional sections and wasteful forced breaks while preserving mandatory content and minimum legibility.
- Every Print Center output, including synthetic and custom outputs, follows the common immutable document-model pipeline. Printer Calibration and Blank Template models contain no resident data.

### 3.4 Interaction

- Ordinary assignment sheets have no digital task-completion or completion-percentage controls.
- Follow-up status is operational continuity metadata, not clinical proof of completion.
- Bathing-generation interaction completes before generation. Required shower count, capacity, week, eligible residents, and locked assignments are explicit request values supplied to a pure builder.
- Bathing requirements are per resident. Never silently flatten them into a global count or exceed a capacity slot to satisfy unmet demand.
- Interactive rows may not contain nested interactive descendants.
- Loading, empty, invalid, success, and failure states must be explicit.
- Content-aware editors show applicable fields in compact dialogs, named steps or dedicated pages; no default monolithic scrolling forms. Drafts survive step changes and failed operations.
- Important warnings/errors and dirty-exit confirmations use a separate centered attention dialog; background editors are inert and only the active dialog traps focus. Inline field hints remain allowed.
- Print Center/Settings show one category at a time; screen pagination and virtualization never limit generated print/export data.
- Destructive data actions require scoped confirmation and safe recovery guidance.

### 3.5 Privacy and integrations

- No analytics, telemetry, cloud sync, remote backup, or third-party data transmission without an approved PRD change and ADR.
- TaskSheet persists no staff/employee personal data. Role, shift, assignment-line code, and area are permitted; employee identities, OS usernames, contacts, schedules, attendance, payroll, performance, credentials, and staff completion data are not.
- Logs avoid unnecessary resident identifiers and never include full exported datasets.
- Secrets are never committed or stored in ordinary application state.
- Printers, exported files, and backups are treated as sensitive-data boundaries.
- Actual runtime paths may be inspected transiently in a local diagnostic view. Every persisted/exported diagnostic uses redacted path tokens and excludes OS usernames.

## 4. Required layers

Dependencies flow inward:

```text
UI / Print Views
      ↓
Application Use Cases
      ↓
Domain Rules and Read Models
      ↓
Repository Interfaces
      ↓
Local Persistence / File / OS Adapters
```

Rules:

- UI components do not implement due-date, overnight, recurrence, or provenance rules.
- Print components do not query mutable storage directly.
- Domain logic does not import Electron, browser globals, React, or CSS.
- OS and persistence details remain behind typed adapters.
- One mutation path owns each important state transition.

## 5. Canonical bounded contexts

- Facility & Settings
- Rooms, Beds & Occupancy
- Residents
- Shifts & Assignment Lines
- Care Catalog & Modifiers
- Resident Tasks & Scheduling
- Unit Tasks
- FYIs & Attention
- Follow-up Continuity
- Wounds
- Bathing
- Operational Dashboard & Huddle
- Print Generation & Reports
- Import, Export, Backup & Provenance
- Application Versioning & Diagnostics

Cross-context behavior belongs in application services/read-model builders, not ad hoc UI joins.

## 6. Canonical time algorithm

For a facility-local assignment date `D`:

1. Parse validated `HHmm` values to minutes after midnight.
2. Start is `D + startMinutes`.
3. End is `D + endMinutes` when `endMinutes > startMinutes`.
4. Otherwise, end is `(D + 1 day) + endMinutes`.
5. Compare scheduled occurrences using half-open ranges `[start, end)` unless the PRD/report explicitly defines a different boundary.

Never infer overnight behavior from shift names or codes.

## 7. Generation pipeline

All printable outputs, including synthetic Blank Template and Printer Calibration documents, follow one pipeline:

1. Validate the complete request and facility context. UI interaction does not occur after this step begins.
2. Resolve the shift window and reporting date.
3. Query eligible active records through repositories.
4. Apply domain inclusion/exclusion rules.
5. Build a typed immutable document model.
6. Sort naturally and deterministically.
7. Render screen preview and print from that same model.
8. Record generation metadata without recording clinical completion.

## 8. Demo and import safety

- Every seed/import batch receives a stable batch ID and source.
- Demo Mode remains visibly active while demo-derived operational records remain.
- “Clear Demo Data” removes only demo-owned data and preserves manual records.
- Import validates and previews before commit.
- Failed import is all-or-nothing.
- Production conversion requires explicit review of facility identity and remaining demo-derived configuration.

## 9. Testing minimums

Every domain change needs tests at the lowest effective level. Required boundary coverage includes:

- `0000`, shift start, shift end, and cross-midnight cases
- Month/year rollover and local daylight-saving transitions where the configured timezone observes them
- Room natural sorting and double occupancy
- Recurrence and date-range edges
- Catalog snapshot stability
- Demo/import/manual cleanup isolation
- Follow-up carry-forward and escalation
- Print inclusion parity between preview and output
- Absence of staff personal data from persistence, exports, diagnostics, fixtures, and printouts
- Keyboard navigation and no nested-interactive regression
- Backup/migration rollback or safe failure

Never weaken a test merely to accept a regression. Change a test only when higher-authority requirements intentionally changed.

## 10. Change triggers requiring an ADR

Create an ADR before changing:

- Persistence engine or storage location
- Time/date representation or shift-boundary rules
- Backup file format
- Print document-model contract
- Identity/privacy defaults
- Single-workstation boundary
- Offline requirement
- Provenance model
- Source-of-truth disclaimer
- Domain ownership between bounded contexts
