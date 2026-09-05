# TaskSheet V2 — Conflict Analysis & Recommended Dispositions

**Status:** Accepted and incorporated  
**Scope:** `PRD.md`, `ARCHITECTURE-ESSENTIALS.md`, `ARCHITECTURE.md`, `AGENTS.md`, and `CLAUDE.md`  
**Prepared for:** SoftVibeSolutions  
**Date:** 2026-09-05  
**Specification incorporation date:** 2026-09-05  

**Implementation addendum:** The later implementation-baseline revision adds `UI-UX-SPEC.md`, `DATA-CONTRACTS.md`, `IMPLEMENTATION-PLAN.md` and `docs/adr/ADR-0001-production-persistence-boundary.md`. SQLite is now selected. The historical uniform bathing-count sketch below is superseded by per-resident requirements; follow-up is occurrence-scoped; wound healing has exact suppression/closure behavior; local path inspection is transient and exported paths are redacted. Historical findings below describe the audited baseline, not newly unresolved conflicts.

## 1. Executive decision

The six audit findings and their recommended dispositions are approved. None invalidates the TaskSheet V2 product model, but two affect foundational implementation boundaries and must be resolved before production persistence or staff-related schemas are implemented.

Approved disposition:

| # | Finding | Severity | Disposition | ADR required? |
| --- | --- | --- | --- | --- |
| 1 | Authority hierarchy inconsistency | Low governance risk | Accept and normalize | No |
| 2 | Browser storage vs. Electron privilege boundary | High architecture/data risk | Accept with production prohibition | Yes |
| 3 | Bathing prompt inside pure generation | Medium design risk | Accept; make input explicit | No |
| 4 | Wounds vs. Resident Tasks ownership | Medium domain risk | Accept; define ownership and references | Recommended |
| 5 | Missing specialized print read models | Medium completeness risk | Accept and enumerate contracts | No |
| 6 | Code of the Month and staff-data omissions | Medium privacy/schema risk | Accept with structured setting and explicit prohibition | Recommended |

These dispositions should be applied as one coordinated documentation revision. Implementation should not begin for affected areas until the production persistence boundary and staff-data policy are incorporated into the controlling documents.

## 2. Decision principles

The resolutions follow five principles:

1. `PRD.md` defines product intent and privacy scope.
2. `ARCHITECTURE-ESSENTIALS.md` records non-negotiable invariants.
3. `ARCHITECTURE.md` describes implementable contracts and ownership.
4. UI collection happens before deterministic read-model generation.
5. Each piece of data has one owning bounded context, even when another context references it.

## 3. Finding 1 — Authority hierarchy alignment

### Confirmed conflict

The suite currently expresses two slightly different hierarchies:

- `PRD.md` and `ARCHITECTURE-ESSENTIALS.md` group `AGENTS.md` and `CLAUDE.md` at the same level.
- `AGENTS.md` places itself above tool-specific instructions.
- `CLAUDE.md` places `AGENTS.md` before its own tool-specific rules.

The inconsistency could produce circular reasoning about whether a structural engineering instruction or a Claude-specific workflow instruction controls.

### Accepted disposition

Use this exact hierarchy everywhere:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. `ARCHITECTURE.md`
4. Approved ADRs, limited by the documents above
5. `AGENTS.md`
6. Tool-specific instructions, including `CLAUDE.md`
7. Tests and implementation

`AGENTS.md` owns repository-wide engineering conduct. `CLAUDE.md` adapts that conduct for Claude Code and cannot weaken or override `AGENTS.md`.

Nested `AGENTS.md` files may add directory-specific instructions but cannot override a parent contract or any higher-authority document unless the parent explicitly delegates that decision.

### Required edits

- Replace the hierarchy in all five documents with the canonical wording.
- Remove phrases that place `AGENTS.md` and `CLAUDE.md` at an equal authority level.
- In `CLAUDE.md`, state that it is a tool-specific implementation of `AGENTS.md`.

### Acceptance checks

- A repository-wide search finds only one hierarchy order.
- No document claims that tests redefine product requirements.
- No tool-specific file claims authority over `AGENTS.md`.

## 4. Finding 2 — Production persistence and the Electron privilege boundary

### Confirmed conflict

`ARCHITECTURE.md` assigns filesystem access and privileged OS operations to the Electron main process, while also allowing a browser-backed local-storage implementation to pass through a validated store service. In a packaged production application, renderer-owned local storage would place the authoritative dataset on the less-privileged side of the Electron boundary and would not satisfy the intended main-process ownership model.

The conflict is not solved merely by wrapping `localStorage` in a renderer service. A service wrapper improves code organization but does not move storage ownership across the trust boundary.

### Accepted disposition

Production TaskSheet V2 data shall be stored in the OS-provided Electron application-data directory and shall be read or written only by the Electron main process through a typed persistence adapter.

The renderer shall access persistence through narrow, typed, validated preload IPC commands. It shall never receive arbitrary filesystem capability or a generic database bridge.

Browser-backed local storage is permitted only for:

- Isolated UI development without real facility data
- Automated component/test environments
- Explicit legacy-data migration input during a controlled transition

It is prohibited as the production authoritative store.

### Required architecture contract

```ts
interface TaskSheetPersistencePort {
  load(): Promise<PersistedEnvelope>;
  save(command: SaveEnvelopeCommand): Promise<SaveResult>;
  createBackup(request: BackupRequest): Promise<BackupResult>;
  previewRestore(fileToken: ApprovedFileToken): Promise<RestorePreview>;
  commitRestore(previewToken: RestorePreviewToken): Promise<RestoreResult>;
}
```

The actual IPC surface may be more use-case-specific. It must not expose raw paths, unrestricted queries, arbitrary keys, or generic file read/write commands.

### Legacy migration rule

If an existing release contains browser-backed production data, the first V2 launch shall:

1. Detect the legacy schema without modifying it.
2. Validate and preview migration eligibility.
3. Create a recoverable migration backup.
4. Import into the main-process-owned production store atomically.
5. Verify counts, schema, provenance, and integrity.
6. Mark migration complete only after verification.
7. Retain a documented rollback path for the support period.

### Required edits

- `PRD.md`: state that production data is stored in the OS application-data directory through the desktop privileged process.
- `ARCHITECTURE-ESSENTIALS.md`: add a hard invariant prohibiting renderer/browser local storage as the production authority.
- `ARCHITECTURE.md`: replace the ambiguous local-storage sentence with explicit dev/test/legacy-migration constraints and define the IPC persistence boundary.
- `AGENTS.md` and `CLAUDE.md`: prohibit new renderer-side production persistence.

### ADR

Create `ADR-0001-production-persistence-boundary.md` covering storage ownership, selected engine/format, atomic-write method, backup compatibility, legacy migration, recovery, and rollback. Selecting JSON files versus SQLite remains an implementation decision within this boundary, but the selected engine must be recorded.

### Acceptance checks

- Packaged builds operate with renderer browser storage empty or disabled.
- Restart persistence succeeds from the main-process-owned store.
- IPC rejects malformed and unauthorized payloads.
- A simulated interrupted save retains a valid old or new state.
- Legacy migration is idempotent and recoverable.
- Resolved production and backup paths appear in privacy-safe diagnostics.

## 5. Finding 3 — Bathing input and pure generation

### Confirmed conflict

The PRD wording can be read as requiring the generation process itself to interrupt execution and prompt for “showers per week.” That would introduce interaction and hidden mutable state into a pipeline otherwise defined as deterministic and side-effect free.

### Accepted disposition

The UI collects and validates the number of showers required per week before submitting a generation request. The value becomes explicit input to a pure assignment/read-model builder.

Recommended contract:

```ts
type BathingAssignmentGenerationRequest = {
  facilityId: FacilityId;
  weekStart: LocalDate;
  showersPerResidentPerWeek: number;
  maxShowersPerShift: number;
  eligibleResidentIds?: ResidentId[];
  lockedAssignments?: BathingAssignmentLock[];
};
```

If the value is already configured as a facility default, the UI may prefill it but must make the chosen value visible and editable before generation. The builder must not open dialogs, query UI state, read storage, or ask follow-up questions.

### Required edits

- `PRD.md`: change “ask before generating” to “collect and validate as an explicit generation input before invoking the builder.”
- `ARCHITECTURE-ESSENTIALS.md`: add explicit parameters to the generation formula.
- `ARCHITECTURE.md`: add `BathingAssignmentGenerationRequest` and `BathingGridDocument` builder contracts.

### Acceptance checks

- The same request and source data produce the same assignments.
- Missing/invalid counts fail before builder invocation.
- The UI clearly identifies whether a value came from a default or user input.
- Tests cover zero, negative, non-integer, capacity-exceeding, and valid values.

## 6. Finding 4 — Wounds and Resident Tasks bounded-context ownership

### Confirmed conflict

“Wound care” appears as a Resident Task example while Wounds is also a separate bounded context with specialized schedules. Without an ownership rule, implementations may duplicate wound details, independently determine activity/healing, or allow two contexts to disagree about whether a wound-related item belongs on current output.

### Accepted disposition

The contexts have different responsibilities:

| Concern | Owning context |
| --- | --- |
| Generic reminder such as “check dressing” | Resident Tasks |
| Task timing, shift, role, and print instruction | Resident Tasks |
| Wound identity, site/location, stage/classification, status, opened/healed dates, and healing history | Wounds |
| Specialized wound registry and wound schedule | Wounds |
| Inclusion of a linked wound task | Resident Tasks, using authoritative wound status supplied by Wounds |

A Resident Task may optionally reference `woundId`. It may snapshot the minimal approved print instruction, but it shall not duplicate the detailed wound registry or become authoritative for wound status.

When a linked wound is healed/inactive, current specialized wound documents exclude it. Linked future resident-task occurrences must be suppressed or routed to review according to an explicit use case; the UI must not independently infer this from copied text.

### Recommended integration contract

```ts
type WoundTaskLink = {
  woundId: WoundId;
  residentTaskId: ResidentTaskId;
  relationship: "assessment" | "dressing" | "monitoring" | "other";
};
```

Cross-context queries should use an application read-model builder or domain service contract. Direct cross-context repository access from UI code is prohibited.

### Required edits

- `PRD.md`: distinguish generic wound-related reminders from the detailed wound registry.
- `ARCHITECTURE-ESSENTIALS.md`: add the single-owner rule and healing-status behavior.
- `ARCHITECTURE.md`: define ownership, link semantics, read-model integration, and status-change behavior.

### ADR

Create an ADR if the implementation must choose between direct ID references, application-level link records, or event-derived projections. The product disposition itself is already clear.

### Acceptance checks

- Detailed wound fields exist only in the Wounds model.
- Healing a wound deterministically updates current-output eligibility without copying the registry.
- Unlinked generic wound reminders remain valid Resident Tasks.
- No UI component performs an ad hoc join or overrides wound status.

## 7. Finding 5 — Specialized Print Center read models

### Confirmed conflict

The PRD requires several specialized outputs that are missing from the architecture’s named immutable read models. The generic phrase “purpose-built read models” is directionally correct but does not provide complete contracts for all required outputs.

### Accepted disposition

Expand the query/read-model inventory to include:

```ts
type PrintDocumentModel =
  | HcaTaskSheetDocument
  | LpnTaskSheetDocument
  | FyiBinderDocument
  | BathingGridDocument
  | WoundScheduleDocument
  | HuddleDocument
  | Lookahead7DayDocument
  | ShiftConfigReferenceDocument
  | BlankTaskSheetTemplateDocument
  | PrinterCalibrationDocument
  | CustomReportDocument;
```

Additionally define supporting request/options contracts:

- `Lookahead7DayQuery`
- `ShiftConfigReferenceQuery`
- `BlankTemplateOptions`
- `PrinterCalibrationOptions`
- `CustomReportDefinition`
- `CustomReportQuery`
- `PrintPackageDocumentSet`

`PrintPackageDocumentSet` composes already-built immutable documents. It does not bypass each document’s eligibility rules.

Printer Calibration is a deterministic synthetic document. It must not query or render resident data.

Blank Template contains headings and handwriting rows but no resident data. Custom reports remain subject to privacy, provenance, status, date, and role constraints.

### Required edits

- `ARCHITECTURE.md` Section 10: enumerate every required document model and query contract.
- `ARCHITECTURE-ESSENTIALS.md`: state that all Print Center outputs follow the common generation pipeline, including synthetic documents.
- `AGENTS.md` and `CLAUDE.md`: require preview/print parity for every new document type.

### Acceptance checks

- Every PRD-mandated Print Center output maps to a named document model or explicit composed set.
- Every model has contract tests and stable deterministic ordering.
- Printer Calibration and Blank Template contain no resident data.
- Custom reports cannot bypass standard filters.
- Package preview and final print use identical child document models.

## 8. Finding 6 — Code of the Month and staff-data policy

### Confirmed gaps

The Dashboard and Huddle View require Code of the Month, but the architecture does not include it in facility settings or a separate configuration model. The suite says staff names are not required for assignment-line configuration, but that wording does not prohibit storage of employee personal information.

### Accepted disposition: Code of the Month

Add a structured optional setting rather than a bare string:

```ts
type CodeOfTheMonth = {
  code: string;
  title: string;
  summary?: string;
  effectiveMonth: YearMonth;
  enabled: boolean;
  updatedAt: Instant;
};

type FacilitySettings = {
  // existing fields
  codeOfTheMonth?: CodeOfTheMonth;
};
```

The Dashboard and Huddle read models consume this setting. If it is absent, disabled, or outside its effective month, they return an explicit configured-empty state rather than stale content. The field is operational education/configuration, not an emergency-procedure source of truth.

### Accepted disposition: staff data

TaskSheet V2 shall not persist staff or employee personal data. Specifically, the production schema shall not store:

- Staff names, initials, employee numbers, usernames, or personal identifiers
- Personal contact information
- Staff schedules, attendance, payroll, credentials, performance, or completion statistics
- Persistent “prepared by,” “assigned to,” or “completed by” identity fields

Assignment and output configuration shall use role, shift, assignment-line code, and area only. Any OS account name observed by Electron must not be copied into TaskSheet application data, exports, printouts, or ordinary diagnostics.

If authentication, accountability, licensing, or multi-user operation is proposed later, it requires a PRD change, privacy assessment, schema/migration plan, and ADR. This prohibition does not prevent an authorized user from operating the local application; it prevents TaskSheet from building an employee-record domain.

### Required edits

- `PRD.md`: make no-staff-personal-data an explicit scope/privacy requirement.
- `ARCHITECTURE-ESSENTIALS.md`: add it as a hard data-minimization invariant.
- `ARCHITECTURE.md`: add the structured setting and explicitly exclude staff entities/fields from the domain model.
- `AGENTS.md` and `CLAUDE.md`: prohibit staff PII in schemas, fixtures, prints, logs, and screenshots.

### ADR

An ADR is recommended to record the privacy decision and define how future requests for authentication, “prepared by,” staff assignment, or licensing identity are handled. The ADR must not weaken the PRD prohibition without a prior PRD revision.

### Acceptance checks

- Schema and repository searches find no employee/staff identity entity or persistent field.
- Fixtures and demos use assignment-line codes, not staff personas.
- Dashboard and Huddle show Code of the Month only for the configured effective month.
- Exports and diagnostics exclude OS usernames and staff identifiers.

## 9. Coordinated document-edit matrix

| Document | Required changes |
| --- | --- |
| `PRD.md` | Canonical hierarchy; main-process production-data boundary; explicit bathing input; wound ownership; no staff PII |
| `ARCHITECTURE-ESSENTIALS.md` | Canonical hierarchy; renderer-storage prohibition; bathing request purity; wound single-owner rule; all-output pipeline; no staff PII |
| `ARCHITECTURE.md` | Canonical hierarchy reference; production IPC persistence; legacy migration; bathing request; wound link/ownership; complete print models; `CodeOfTheMonth`; no staff entities |
| `AGENTS.md` | Canonical level 5; production renderer-storage prohibition; staff-data prohibition; specialized-output parity checks |
| `CLAUDE.md` | Canonical level 6; explicitly subordinate to `AGENTS.md`; same persistence/privacy/print enforcement |

## 10. Recommended implementation sequence

- [x] Record approval of this report’s dispositions.
- [x] Update all five documents in one coordinated documentation change.
- [x] Create ADR-0001 for the production persistence boundary and selected SQLite storage engine.
- [ ] Create optional ADRs for wound linking and staff-data privacy.
- [ ] Add schema/read-model types after documentation synchronization.
- [ ] Add architecture conformance tests.
- [ ] Implement or migrate production persistence.
- [ ] Run clean-machine, restart, migration, backup/restore, privacy, and physical-print validation.

## 11. Release impact

These gaps do not require abandoning the TaskSheet V2 design. However:

- Finding 2 is a release blocker if a packaged V2 build still treats renderer/browser local storage as authoritative production persistence.
- Finding 6 is a schema/privacy blocker if staff personal data is introduced before the prohibition is documented and tested.
- Findings 3–5 are implementation blockers for their specific modules because ambiguity could produce incompatible contracts.
- Finding 1 is a governance defect that should be corrected before agent-driven implementation begins.

## 12. Final recommendation

All six dispositions are approved with the refinements in this report:

- one global seven-level authority hierarchy;
- main-process-owned production persistence with renderer storage limited to development, tests, and controlled legacy migration;
- explicit bathing-generation inputs;
- single ownership of detailed wound data with optional Resident Task links;
- named immutable contracts for every Print Center output;
- structured Code of the Month configuration; and
- a strict prohibition on persisted staff/employee personal data in TaskSheet V2.

The five controlling documents shall be revised together so no intermediate version contains conflicting rules.
