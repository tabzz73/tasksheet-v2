# TaskSheet V2 — Product Requirements Document

**Document status:** Authoritative product baseline  
**Owner:** SoftVibeSolutions  
**Version:** 2.0-draft  
**Specification revision:** Implementation baseline 4 — local accounts, CRUD and permissions  
**Last updated:** 2026-09-05  

## 1. Document authority

This PRD is the highest-authority product document for TaskSheet V2. It defines what the product is, who it serves, its required behavior, and its scope boundaries.

When documents conflict, use this order:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. `ARCHITECTURE.md`
4. Approved Architecture Decision Records (ADRs), within the authority granted by the documents above
5. `AGENTS.md`
6. Tool-specific instructions, including `CLAUDE.md`
7. Tests and implementation

Do not silently resolve a material conflict. Record the conflict, follow the higher-authority document, and create or propose an ADR when a durable design decision is required. Tests prove implemented behavior; they do not redefine the product.

Companion specifications: `UI-UX-SPEC.md` defines screen and print behavior delegated by this PRD; `DATA-CONTRACTS.md` implements domain details delegated by `ARCHITECTURE.md`; `IMPLEMENTATION-PLAN.md` defines delivery phases and acceptance evidence without changing scope. Each companion is subordinate to its delegating document and the higher-authority suite. Illustrative blueprint images are explanatory, not approved UI or print templates.

## 2. Product summary

TaskSheet is a local-first Windows desktop application that helps a single care facility organize resident care information, generate assignment sheets, and print concise shift-ready documents for HCA and LPN/RN workflows.

The product’s operating model is:

> **ORGANIZE → GENERATE → PRINT**

TaskSheet complements the facility’s official systems, including care plans, eMAR, PointClickCare, Yardi, and facility policies. It does not replace them and is not the clinical source of truth.

## 3. Problem statement

Care staff frequently begin shifts with fragmented information spread across care plans, eMAR, verbal handover, binders, and manager-only systems. Generic task lists do not reliably present the right information by role, shift, resident, room, and due date. Handwritten assignment sheets are slow to prepare, inconsistent, and difficult to keep legible.

TaskSheet reduces this preparation burden by turning configured resident tasks, unit routines, FYIs, wound information, shift definitions, and operational attention items into predictable, printable working documents.

## 4. Goals

TaskSheet V2 shall:

- Produce accurate, legible HCA and LPN/RN assignment sheets with minimal setup and paper use.
- Make current operational information visible to the charge nurse without turning the app into a digital completion tracker.
- Support configurable facilities, rooms, shifts, assignment lines, care catalogs, and print layouts.
- Preserve correct behavior for overnight shifts and due-date calculations.
- Make demo, imported, and manually entered data distinguishable and safely manageable.
- Run without internet access on one Windows workstation.
- Provide transparent, explainable output generation and safe backup/export behavior.
- Remain usable with keyboard, mouse, and touch-oriented controls.

## 5. Non-goals

TaskSheet V2 is not:

- An EHR, eMAR, medication administration record, charting system, or legal clinical record.
- A live digital task-completion, staff-performance, or productivity-tracking platform.
- A staff scheduling or payroll system.
- A multi-facility platform.
- A real-time multi-workstation collaboration system.
- A substitute for clinical judgment, approved care plans, facility policy, or emergency procedures.
- A system for storing unnecessary clinical detail.

No in-app “Done,” “Complete,” completion percentage, or staff-performance metric shall be added to ordinary HCA/LPN assignment sheets. The follow-up workflow defined below is an operational continuity exception and must not be presented as care-charting evidence.

## 6. Users and roles

### 6.1 Primary users

- **Charge nurse / supervisor:** configures shifts, reviews operational status, prepares huddles, generates prints, and manages follow-ups.
- **LPN/RN:** receives a clinical assignment sheet containing due resident and unit tasks, important information, and documentation space.
- **HCA:** receives a dense, quick-scanning assignment sheet optimized for bedside workflow and paper check-off.
- **Administrator:** manages facility setup, catalogs, imports/exports, demo data, backups, and application information.

### 6.2 Output identity rules

Printed resident identity is limited by default to:

- First name
- Last name
- Room identifier

Staff names and employee identities are not stored for assignment-line configuration or output. Assignment lines are represented by configurable short codes such as `D1`, `E4`, `N1`, `D1LPN`, or `NLPN`.

### 6.3 Local accounts and CRUD permissions

Require offline local login with Administrator, Editor and Viewer access roles, independent of HCA/LPN/RN care-output roles. Administrator manages accounts, configuration, deletion and full transfers/recovery. Editor creates/edits operational records; delete/deactivate and scoped catalog/report transfers require explicit grants. Viewer can view/preview/print authorized data but cannot mutate business records. All roles may change their own password and lock/logout.

`ACCESS-CONTROL.md` defines the delegated normative CRUD matrix, grants, account lifecycle, security audit and authentication rules. `docs/adr/ADR-0002-local-accounts-and-authorization.md` records this user-approved change. Minimal account IDs, chosen login names, password verifiers and permissions are allowed solely for access control; employee profiles, payroll, scheduling and performance remain excluded.

First run creates an Administrator before facility setup, without default credentials. Protect the last enabled Administrator and provide controlled recovery. Enforce all permissions in main-process services, including direct IPC, imports, exports and lifecycle actions. Hiding controls is insufficient. Editing does not imply deletion, export, restore or account-management rights; dependency/history constraints apply even to Administrator.

## 7. Product principles

1. **Print is a primary interface.** Screen workflows must produce dependable paper outputs.
2. **The official source remains outside TaskSheet.** Every output must reinforce this boundary.
3. **Configuration over hard-coding.** Facility, room, shift, task, and label differences must be editable.
4. **No silent assumptions.** Missing shift, role, due date, or resident selection must create a clear state or validation message.
5. **No misleading automation.** Generated suggestions or defaults must remain reviewable.
6. **Local-first and recoverable.** Core functionality must work offline, with explicit backup and restore controls.
7. **Operational visibility without charting.** Dashboard and huddle views surface attention; they do not become the clinical record.

## 8. Primary navigation

The main navigation shall be:

1. Dashboard
2. Shifts
3. Residents
4. FYI Binder
5. Print Center
6. Settings

The sidebar is navigation-only. Quick Add belongs in a contextual action area and opens a chooser for:

- Care Task
- Unit Task
- FYI

Help & App navigation shall include:

- User Manual
- App Information
- Developer Information

Developer Information shall show:

- Developer/Publisher: **SoftVibeSolutions**
- Positioning: **Healthcare workflow and productivity software**
- Product name and version
- Support and legal information when configured

## 9. First-run setup

On a clean installation, enroll the first local Administrator and recovery material, then guide the authenticated Administrator through:

1. Facility identity: name, address, main phone, nursing/unit phone, fax, and optional contact details.
2. Locale: timezone, 12/24-hour display preference, week-start day, and overnight reporting basis.
3. Physical organization: configurable room identifiers and optional building/wing/floor/bed structure.
4. Roles and shifts: editable HCA and LPN/RN shifts with name, short code, role, start time, and end time.
5. Initial data choice: start clean or intentionally load clearly labeled fictional demo data.
6. Print calibration and sample output.

Demo data must never silently masquerade as production data. While demo-derived operational data is present, a persistent, unmistakable Demo Mode indicator shall be visible. Conversion to real use must include an explicit cleanup/review workflow.

## 10. Time, dates, and shifts

### 10.1 Time rules

- Operational time entry and print may use 24-hour military time without a colon, such as `0700` and `1900`.
- Stored time shall use a canonical validated representation.
- If an end time is less than or equal to a start time, the shift is overnight.
- Overnight due-date and print inclusion behavior must be deterministic and covered by boundary tests.

### 10.2 Shift configuration

Users shall be able to add, edit, deactivate, and safely delete shifts when no protected references prevent deletion. Each shift includes:

- Full name
- Unique short code
- Role
- Start and end time
- Active/inactive status
- Optional display order and area metadata

The product shall not assume a fixed number of shifts or fixed codes. The shift list defaults to a compact list and may offer a List/Cards toggle. Each row or card opens the Shift Workspace and exposes one clear, accessible navigation target.

## 11. Residents and occupancy

Resident records shall support:

- First name and last name
- Room/bed placement
- Status: Active, In Hospital, Out on Pass, and inactive historical states such as Moved Out or Deceased
- Effective dates where required
- Provenance metadata for manual, imported, or demo origin

Rules:

- One resident has at most one current placement.
- One bed has at most one current resident.
- Rooms may have multiple beds and custom identifiers such as `L101`, `101A`, `101B`, or `101LF`.
- Room sorting shall be natural and predictable.
- Resident selectors must use smart search, must not auto-select the first resident, and must clearly show an empty selection.
- Historical residents must not appear on current assignment sheets unless explicitly included by a specialized report.
- TaskSheet excludes employee profile data; minimal local account data is permitted only under section 6.3. Assignment configuration and output identify role, shift, assignment-line code and area, not employee identities.

## 12. Work information model

TaskSheet distinguishes these concepts:

### 12.1 Resident Tasks

Care activities assigned to a resident, with role, timing/frequency, shift applicability, important instructions, active dates, and optional print/display visibility.

Examples include blood glucose and insulin prompts, wound care, catheter changes, vital signs, behaviour tracking, fluid monitoring, and scheduled weights.

### 12.2 Unit Tasks

Non-resident routines associated with a role or shift, such as start-of-shift checks, handoff, medication-fridge temperature, or unit safety routines.

### 12.3 FYI / Standing Information

Information that staff need to know but do not complete as a task. FYIs may be scoped to facility, role, shift, resident, or unit and may have effective dates and priority.

### 12.4 Attention Items

Time-bounded operational notices about a resident, unit, or site, such as an outage, drill, safety issue, or resident-specific concern. Attention items are not care tasks and do not carry completion controls.

### 12.5 Wounds

Structured wound information may generate wound schedules and quick prints. Healed/inactive wounds shall be suppressed from current due output while remaining available to authorized historical reports.

The Wounds bounded context exclusively owns detailed wound identity and registry data, including location/site, stage or classification, status, opened/healed dates, and healing history. Resident Tasks may contain generic wound-related reminders, such as “check dressing,” and may reference a wound by stable ID, but they do not duplicate or override the detailed registry. A linked wound’s authoritative status governs whether wound-specific current output is eligible.

## 13. Catalogs, schedules, and modifiers

Task and modifier catalogs shall be editable and version-aware. A task assignment shall preserve a snapshot of display-critical catalog data so later catalog edits do not silently rewrite historical or already-configured meaning.

A task template may define:

- Name and category
- Eligible role or credential
- Default duration
- Required staff count
- Default instructions
- Active/inactive state

Stackable modifiers may change:

- Added workload minutes
- Minimum staff count
- Credential requirement
- Printed instruction

Scheduling shall support:

- One or more explicit times
- Shift/period-based tasks
- Selected weekdays
- Interval schedules such as every 14 or 28 days
- Specific calendar-day schedules
- Start/end dates
- Due-today and lookahead calculations

Two-person care must represent workload and elapsed-time semantics explicitly; it must not accidentally double duration in one place and not another.

## 14. Operational visibility

Reusable operational items shall use a shared visibility contract:

```ts
type OperationalVisibility = {
  showOnDashboard: boolean;
  showInHuddle: boolean;
  priority: "routine" | "important" | "attention";
};
```

The Dashboard is an operational information center. It may show:

- Current Unit Situation
- Residents In Hospital or Out on Pass
- Latest or urgent FYIs
- Resident Follow-up
- Code of the Month
- Customizable operational cards
- Attention indicators on items requiring review

`Code of the Month` is an optional, facility-configured, month-effective item with a code, title, optional short summary, enabled state, and last-updated timestamp. It is operational education content and not the source of truth for emergency procedures.

If all optional widgets are hidden, the dashboard must display an explanatory empty state and a path to Customize.

The Huddle View shall present a concise, readable screen and print layout for verbal shift huddle. It includes, when applicable, attention items, away residents, urgent FYIs, current follow-ups, and Code of the Month.

## 15. Resident follow-up continuity

Follow-up supports continuity for selected resident tasks and is not proof that care was performed.

Required fields:

```ts
type FollowUpStatus =
  | "due"
  | "done"
  | "carry_forward"
  | "no_longer_needed"
  | "needs_review";
```

- `followUpDueDate` is set once for an occurrence and is not reset by carry-forward.
- `followUpCarryForwardCount` increments when carry-forward is selected.
- `followUpUpdatedAt` records the latest status change.
- Default escalation threshold is 3 carry-forwards and is facility-configurable.
- Overdue indicators may use clear forms such as “Day 4” or “4/5,” with an accessible textual explanation.
- A single validated mutation shall own follow-up status transitions.

Follow-up state belongs to a separate `FollowUpOccurrence`, keyed by task ID, schedule revision, original due date, and schedule slot. Completing one occurrence never completes the recurring task or future occurrences. Retries with the same command ID do not increment carry-forward twice. Terminal states are `done` and `no_longer_needed`; reopening is an explicit reviewed action preserving the original due date and history. See `DATA-CONTRACTS.md` for transitions and schedule-edit reconciliation.

## 16. Bathing grid

The bathing grid shall:

- Use days across columns and assignment lines down rows.
- Default to room identifiers for compact printing.
- Display occupancy such as `2 of 2`, `1 of 2`, or `Available` where useful.
- Collect and validate each resident’s own showers-per-week requirement before invoking the assignment builder. A facility default may prefill individual rows, but users review each resident’s value. One global count must not overwrite individual requirements. The pure builder receives explicit per-resident requirements, capacity slots, and locked assignments and reports unmet demand without exceeding capacity.
- Default to a maximum of two showers per shift unless facility configuration says otherwise.
- Print in the established TaskSheet visual language.

## 17. Shift Workspace

The Shift Workspace shall provide:

- Selected date, shift, role, time range, and assignment identity
- Resident tasks due for that shift/date
- Unit tasks
- Relevant FYIs and attention information
- Workload summary without staff-performance scoring
- Clear empty states and validation when required context is absent
- Direct access to preview and print

The workspace may support workload balancing suggestions, but all changes must be explainable, reviewable, reversible before final print, and oriented around assignment lines—not employee surveillance.

## 18. Print Center

The Print Center is a first-class module with:

- Date navigation
- Per-shift Quick Print and batch printing
- Change-detection indicators
- Print packages, including HCA Daily and LPN Clinical
- Wound quick prints
- Specialized documents: Bathing Grid, Wound Schedule, 7-Day Lookahead, Shift Configuration Reference, FYI Binder, Huddle View, Blank Template, and Printer Calibration
- Report catalog
- Custom Print Builder with columns, filters, grouping, sorting, layout, density, saved presets, and CSV export where appropriate
- One consistent preview-to-print pathway

Custom reports must not bypass privacy, active-status, date-boundary, or role filters.

Every Print Center output—including 7-Day Lookahead, Shift Configuration Reference, Blank Template, Printer Calibration, Custom Reports, and composed Print Packages—shall use an explicit immutable document model or composed set of such models. Printer Calibration and Blank Template outputs contain no resident data.

## 19. Assignment-sheet requirements

### 19.1 Shared visual language

All primary TaskSheets shall use:

- Facility/site name and complete contact header
- Shift short code and time
- Assignment date
- Optional role label
- Compact typography and strong table alignment
- Repeating table headers on multi-page output
- Page number and document identity in the footer
- Adequate handwriting space
- Printer-safe monochrome contrast
- A clear generated timestamp when appropriate

Every HCA and LPN/RN sheet must include this notice:

> **This sheet is a guide only. Facility policy and the approved clinical record remain the source of truth. Report any discrepancies or unclear instructions to the team lead.**

### 19.2 LPN/RN primary format

Default columns:

`☐ | Time | Room | Resident | Task | Important Information | Vitals / Results | Notes / Follow-up`

The sheet includes due-today clinical tasks, relevant medications-related prompts, wound/catheter tasks, quick-vitals space, unit tasks, and relevant information. It must not imply that checking paper updates the authoritative clinical record.

### 19.3 HCA primary format

Default columns:

`☐ | Time | Room | Resident | Task | Important Information | Notes`

The HCA format is simpler and denser than LPN/RN. It is optimized for rapid scanning, paper check-off, and minimal page count. A dedicated `Vitals / Results` column is not shown by default.

### 19.4 FYI Binder

The FYI Binder shall support:

- Full Binder
- Changes Since Last Print
- Facility header, binder version, generated timestamp, and change summary
- Deduplicated organization: Shared Facility → Role All Shifts → Role/Shift sections
- Predictable version lifecycle

Standing FYIs do not affect due or overdue task counts.

## 20. Data management

TaskSheet shall provide controlled workflows for:

- Export/backup
- Restore/import with validation and preview
- Catalog import/export separately from operational data
- Demo-data load and clear
- Imported-data clear by provenance where safe
- Manual-data preservation when demo data is cleared
- Corruption detection and safe recovery guidance

Exports are inactive backups, not a live shared database. Core application data remains on the workstation for V2. Uninstall/reinstall behavior and data-retention consequences must be documented and tested.

All data records that can be seeded or imported shall support provenance such as `source` and `sourceBatchId`.

In packaged production, the authoritative store shall reside in the OS-provided Electron application-data directory and shall be owned by the Electron main process. Renderer/browser local storage is not permitted as the production authoritative store. The renderer accesses persistence only through narrow, typed, validated preload IPC use cases. Browser-backed storage is limited to isolated development/testing or controlled legacy-data migration.

Production V2 uses SQLite under `app.getPath("userData")`, as specified by `docs/adr/ADR-0001-production-persistence-boundary.md`. This is a target architecture decision, not a claim that existing releases have already migrated.

### 20.1 Separate import/export scopes

Provide independent permission-controlled Import and Export actions for Whole Database, Wound Care Supplies Catalog, and Care Tasks Catalog in CSV, Excel `.xlsx` and JSON. Whole Database logical exchange includes all supported business records/history and relationships, settings, catalogs, schedules, follow-ups, provenance and presets, regardless of screen filters. Exclude accounts, grants, authentication secrets, security audit, OS paths, employee profiles, caches and engine internals; display these exclusions. Native `.tasksheet-backup` includes security tables and is a sensitive Administrator-only artifact. Normal restore preserves current accounts/policy; fresh-machine recovery verifies a backup administrator before activation under ACCESS-CONTROL.md.

Whole-database CSV uses one downloadable ZIP containing related CSV tables and a manifest; Excel uses one workbook with related worksheets; JSON uses one structured document. Do not flatten an entire relational database into a lossy single table. Catalog CSV uses one standalone file per selected catalog, Excel one workbook and JSON one document. Supply editable templates and documented field mappings. Preserve leading zeros, military times, multiline instructions, stable IDs, references and active/inactive values across formats.

Wound Care Supplies Catalog is a reusable product list, separate from resident wounds: item code/name, brand, category, size/dimensions, unit, package quantity, optional supplier/catalog number and notes, and active/inactive status. It contains no resident identifiers, wound assessments or stock/inventory transactions. Care Tasks Catalog contains reusable task definitions and modifier metadata, not resident assignments or clinical records. Catalog exchange must never bring in or clear resident/facility data.

Imports require schema validation, preview, conflict resolution and explicit confirmation before an atomic commit. Whole-database imports replace the selected workstation dataset after a verified pre-import backup and explicit facility-identity warning; do not silently merge facilities. Catalog imports default to add/update with reviewed conflicts; scoped replacement must preserve referenced history and snapshots. Reimport must not duplicate unchanged items. Exported catalog changes must not rewrite existing assignment snapshots. See `DATA-EXCHANGE.md`, delegated by ARCHITECTURE.md, for formats, fields and round-trip acceptance rules.

## 21. Accessibility and UX quality

TaskSheet shall target WCAG 2.2 AA principles for application workflows:

- Full keyboard navigation for interactive controls
- Visible focus states
- Accessible names and states
- No nested interactive controls
- Touch-friendly controls on mobile-sized displays
- Status meaning not conveyed by color alone
- Correct table semantics for static tables and appropriate grid/list semantics for interactive rows
- Clear loading, empty, validation, success, and failure states

Rows that contain action buttons must not be implemented as a clickable interactive ancestor containing nested buttons. Use a sibling navigation overlay or distinct action regions.

### 21.1 Content-aware forms and attention dialogs

Forms adapt to the operation and context, showing only applicable inputs. Short forms use compact dialogs; complex resident/task/configuration forms use named steps or sections with persistent draft state, or a dedicated editor page. Do not place an entire resident profile or complex task editor in one tall scrolling modal. Keep title/context and primary actions visible; allow bounded scrolling for small screens, enlarged text and unusually long content without clipping or hiding fields.

Important errors, consequential warnings, destructive confirmations and unsaved-change decisions appear in a separate, centered attention dialog above the current view, never as a warning panel buried inside the form. Field-specific correction hints may remain beside their inputs; a failed submission requiring attention uses a centered summary with a route to the affected field/step. Background forms are inert while the attention dialog is active; drafts remain intact.

Cancel, close, Escape, backdrop dismissal, navigation and application close must protect dirty resident, task, FYI, wound, shift, settings and custom-report editors. Ask “Discard unsaved changes?” with “Keep editing” and “Discard changes”; default focus is the safe action. Clean forms close without interruption. Successful saving clears the dirty state; failed saving preserves it. Never imply that abandoning an editor reverses an already committed operation.

### 21.2 Compact navigation and long collections

Print Center and Settings are categorized workspaces, not long stacks of expanded cards. Show one selected category at a time with stable navigation, search and preserved filter context. Use pagination/search for large catalogs and lists, named steps for complex builders and a dedicated paged print preview. All functions remain discoverable; collapsing content must not hide errors, required fields or selected items. Screen pagination must never truncate the full requested printed/exported result.

### 21.3 Ink and paper economy

Default paper output uses white backgrounds, black text, lightweight rules and outline checkboxes. Omit decorative imagery, shadows, large filled headings and zebra fills; do not print screen chrome or dialogs. Consolidate compatible rows, omit empty optional sections and avoid automatic one-page-per-resident layouts. Maintain approved columns, notices, readable type and handwriting space; paper savings never justify dropping due work, truncating instructions or shrinking text below the print minimum. Preview exposes total pages and compact/standard density before printing. Package deduplication must preserve intentionally repeated independently usable shift sheets. See UI-UX-SPEC.md for layout and validation rules.

## 22. Security and privacy

- Collect and print only data necessary for the approved workflow.
- Core use shall not require internet connectivity.
- Do not add analytics, telemetry, cloud sync, or external transmission without an explicit product decision and privacy review.
- Local data, backups, and prints must be treated as sensitive facility information.
- Destructive actions require explicit confirmation and, when material, a recoverable backup.
- Logs must not expose resident details unnecessarily.
- Employee names, initials, employee numbers, contacts, schedules, attendance, payroll, performance and staff completion records remain prohibited. Section 6.3 allows minimal local login names, password verifiers, permissions and security audit only. Fictional account aliases may be used for auth tests; no real credentials in fixtures. OS account names remain excluded. Logical exports and care printouts omit the security domain; native backups follow ACCESS-CONTROL.md.
- Generated sheets require appropriate physical handling and secure disposal under facility policy.

Resolved application-data paths may contain Windows usernames. App Information may display the actual runtime path locally on explicit user request; this transient diagnostic is not an employee record. Logs, copied support summaries, exports, and diagnostics bundles must use `<USER_DATA>` and other redacted path tokens. This exception does not authorize persisting OS usernames; chosen application login aliases are governed separately by section 6.3.

### 22.1 Linked wound lifecycle

Marking a wound healed/inactive suppresses all linked wound-specific current/future task occurrences at or after the effective timestamp. Open linked follow-ups transition to `no_longer_needed` with reason `wound_inactive`; already terminal records and historical snapshots remain unchanged. Generic unlinked reminders are unaffected. Reactivation does not automatically revive suppressed work: users review and explicitly reactivate the linked task schedule. These changes are operational configuration, not clinical charting.

## 23. Reliability and performance

- Startup and primary navigation shall remain responsive on supported Windows hardware.
- Generation must be deterministic for the same data, configuration, date, and shift.
- Save operations must be atomic from the user’s perspective.
- Recurring generation must be idempotent.
- A failed import, migration, or save must not partially corrupt the current dataset.
- Print preview and printed output must agree on inclusion, order, and labels.

## 24. Packaging and support baseline

- Target: Windows 10/11 x64.
- Distribution: signed setup installer `.exe` when production signing is available.
- Deployment: one workstation, one local application-data store.
- Production storage: OS application-data directory, owned by the Electron main process and accessed through validated typed IPC.
- Offline operation: required for all core workflows.
- App Information must disclose version, storage model, backup responsibility, and single-workstation limitation.

## 25. Acceptance and release gates

A release candidate cannot be called production-ready until it passes:

- Static analysis and type checking
- Unit and domain-boundary tests
- Persistence and migration tests
- Import/export/restore tests
- Navigation and accessibility tests
- Overnight shift and due-date boundary tests
- Clean-machine Windows installation test
- Restart and uninstall/reinstall data-lifecycle tests
- Demo-to-real conversion test
- Physical print certification for representative HCA, LPN/RN, FYI Binder, Bathing Grid, Huddle, wound, and multi-page outputs
- Backup restoration from a separate inactive backup copy

Physical print certification shall record printer, driver, paper size, orientation, scaling, page counts, clipping, readability, and reviewer.

## 26. Success measures

Success is measured by workflow outcomes, not resident-care claims:

- Reduced time to prepare a shift package
- Fewer manual transcription corrections before print
- High first-attempt print-fit rate
- Successful recovery from validated backups
- Users can identify current unit situation and required prints without training-heavy navigation
- No demo data mistaken for production data during pilot validation

## 27. Change control

Any proposal that adds cloud synchronization, multi-workstation collaboration, clinical charting, staff completion tracking, medication administration, or multi-facility scope is a product-level change. It requires PRD revision, privacy/security analysis, migration planning, and an ADR before implementation.
