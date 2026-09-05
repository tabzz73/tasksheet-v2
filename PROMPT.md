# TaskSheet V2 — First coding-agent prompt

Use this after opening the intended TaskSheet repository in your coding IDE. Place this package's Markdown files at the repository root and preserve `docs/adr/` beneath it. Review differences before replacing existing repository instructions. Copy everything between BEGIN PROMPT and END PROMPT into the coding agent, or ask it to read and execute this file.

This prompt starts implementation; it does not change specification authority or certify an existing release.

---

## BEGIN PROMPT

Implement TaskSheet V2 in this repository using the supplied specification suite. Complete phase 0 and the first end-to-end workflow from phase 1. Do not stop after producing a plan or a static UI mockup. Inspect existing code first, retain working behavior that matches the requirements, and make cohesive, verified changes.

### 1. Read the project contract

Read these files completely before editing application code:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. `ARCHITECTURE.md`
4. `docs/adr/ADR-0001-production-persistence-boundary.md` and other applicable ADRs
5. `DATA-CONTRACTS.md`
6. `DATA-EXCHANGE.md`
7. `UI-UX-SPEC.md`
8. `IMPLEMENTATION-PLAN.md`
9. `AGENTS.md` and applicable nested instructions
10. `CLAUDE.md` when using Claude Code, or the applicable tool-specific instructions
11. `TASKSHEET_V2_CONFLICT_ANALYSIS.md` for decision history, accounting for its superseding implementation addendum

Reading order does not change authority. Follow PRD → Architecture Essentials → Architecture → approved ADRs → AGENTS → tool-specific instructions → tests/implementation. Companion specifications have only the authority delegated by their controlling documents. This kickoff prompt does not override the suite.

Report material contradictions with the controlling rule and a concrete proposed resolution. Continue independent work that is already authorized. Do not silently invent product behavior or repeatedly ask for approval of routine choices covered by the specification.

### 2. Establish the actual repository state

Inspect Git status, repository identity, package scripts and lockfiles, application entry points, Electron/preload configuration, persistence, schema/migrations, tests and existing UI/print references. Preserve unrelated changes and user data. Do not reset the worktree, rewrite the application wholesale, or modify immutable release tags/installers.

Classify existing features as working, incomplete, conflicting or unverified based on inspected evidence. Record the actual runtime versions rather than copying versions from previous conversations. Select and pin an Electron-compatible SQLite binding and prove it works in the packaged Windows target when that environment is available. If only a specification package is present and the repository cannot be identified, report that concrete blocker rather than claiming an existing app was inspected.

Use inspected, approved screen and print references. The architectural blueprint images are explanatory and are not screen templates. If original samples are unavailable, use the proposed defaults in UI-UX-SPEC.md and label visual fidelity unverified; this does not block the functional first workflow.

### 3. Preserve the product boundaries

TaskSheet by SoftVibeSolutions is an offline-capable, single-facility, single-workstation Windows desktop application whose lifecycle is ORGANIZE → GENERATE → PRINT. It complements facility policy and approved clinical records. It is not an EHR, eMAR, staff scheduler, digital care-completion tracker or shared network database.

- Use main-process-owned SQLite under the application-data directory and narrow typed, validated preload IPC.
- Never make renderer localStorage the production database, expose generic file/SQL access, or migrate real data without a validated recovery path.
- Keep domain rules pure and shared. UI components must not reinvent recurrence, overnight windows, occupancy, provenance or follow-up logic.
- Do not store staff/employee identities. Use role and assignment-line codes. Redact usernames and paths in exported diagnostics.
- Ordinary assignment sheets have no in-app Done/Complete actions or completion percentages. Follow-up is a separate occurrence-based operational continuity workflow, not proof of care.
- Keep manual, demo and imported provenance distinguishable. Load fictional demo data only deliberately and show the persistent Demo Mode indicator.
- No cloud synchronization, telemetry or external data transmission is introduced by this task.

### 4. Build the first complete workflow

Deliver: facility setup → one configurable shift → one resident and bed placement → one care task → SQLite save → immutable preview → user-initiated print.

Implement enough role configuration and fixtures to demonstrate both HCA and LPN output profiles. Include facility contact settings, timezone, shift name/short code/role/start/end, resident smart search and placement, a catalog-backed task snapshot, explicit timing and assignment mapping, and correct eligibility for the selected date/shift.

Use real persistence and application services, not arrays or mock handlers that disappear on restart. Validate occupancy and shift/time boundaries. The same typed immutable document model must power preview and printing. Restore saved state after restarting offline. Make invalid input, no configured shift, no residents and no due tasks explicit and distinguishable.

Use fictional test data. Keep the first workflow focused; do not build every module at once. If some phase-1 behavior already works, verify it and implement the missing portions rather than duplicating it.

### 5. Implement the shared interaction patterns from the start

- Short operations use compact content-aware dialogs. Longer resident/task forms use meaningful steps with retained draft values; large editors use dedicated pages.
- Show only relevant fields. Opening Add Task from a deliberately selected resident may visibly prefill that resident; global Quick Add never chooses the first resident automatically.
- Keep context and primary actions reachable. Avoid default long scrolling modals; allow bounded scrolling when needed for narrow screens, enlarged text or long content.
- Important errors, consequential warnings and discard-change confirmations use separate centered attention dialogs. Field-specific hints may remain beside inputs.
- Protect dirty edits on Cancel, X, Escape, backdrop, navigation and normal application close. Offer Keep editing / Discard changes with safe default focus. Preserve drafts on failed save; do not pretend a discard undoes a committed operation.
- Only one active dialog traps focus; the background editor is inert. Support keyboard operation and focus return.
- Keep navigation categorized and extensible. Settings and Print Center must not become long walls of expanded cards. Do not show dead links or misleadingly functional placeholders for later-phase modules.

### 6. Enforce print economy and required content

Follow the exact columns, notice, typography, margins and overflow rules in PRD.md and UI-UX-SPEC.md. HCA is denser and omits a dedicated Vitals/Results column; LPN retains that writing space.

Default to white backgrounds, black text, thin rules and outline checkboxes. Omit decorative fills, shadows, screen chrome and dialogs. Consolidate compatible content, omit empty optional sections and avoid unnecessary forced page breaks. Never save paper by dropping tasks, truncating instructions, shrinking below the minimum font, or removing handwriting space.

Every primary sheet includes:

“This sheet is a guide only. Facility policy and the approved clinical record remain the source of truth. Report any discrepancies or unclear instructions to the team lead.”

Preview shows total pages and density controls. Repeating headers and footers remain clear on multi-page output. Screen pagination must never limit printed/exported records. Physical print checks are mandatory evidence before release readiness, but cannot be fabricated from browser or PDF inspection.

### 7. Keep later-phase contracts compatible

Do not implement the entire roadmap in this first milestone, but preserve its contracts:

- Per-resident bathing requirements, capacity-aware proposals and separate confirmation.
- Independent follow-up occurrences with immutable due dates and retry-safe status commands.
- Wounds own their registry; healing suppresses linked work under the exact lifecycle rule.
- Dashboard/huddle visibility, FYI scope and structured Code of the Month.
- Separate import/export for Whole Database, Wound Care Supplies Catalog and Care Tasks Catalog in CSV, Excel and JSON. Full CSV is a related-table ZIP, Excel a multi-sheet workbook, JSON a structured envelope. Catalog transfers exclude residents and preserve existing snapshots.
- Native SQLite backup and validated legacy migration/restore are distinct from logical exchange.

Do not claim these later features implemented simply because types, menu labels or placeholders exist.

### 8. Verify and hand off

Use repository-defined gates and meaningful tests. Cover phase-1 acceptance scenarios AC-01–05, AC-26–30 and AC-34–35, plus relevant time/occupancy boundaries. Run applicable type/lint/unit/application/adapter/component tests, build and E2E checks. Verify restart persistence with renderer storage non-authoritative. Exercise centered warnings, draft protection, keyboard navigation and print content parity.

Inspect screen and rendered print samples, including long text and multiple pages. If Windows packaging, a real printer or another required capability is unavailable, complete the software work that can be verified and record the exact pending hardware checks. Do not call the build production-ready.

End with a concise milestone report containing:

1. What now works end to end and how to launch/test it using actual repository commands.
2. Existing behavior reused and changes made.
3. Acceptance IDs with passed, failed or pending evidence; commands actually run.
4. Screenshots/print samples and whether visual/physical review occurred.
5. Remaining blockers, migration risks and the next phase from IMPLEMENTATION-PLAN.md.

Begin now with the repository inspection, give a short evidence-based implementation plan, and proceed through the first working milestone without stopping at planning alone.

## END PROMPT
