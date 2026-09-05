# CLAUDE.md — TaskSheet V2 Repository Instructions

This file instructs Claude Code and compatible coding agents working in the TaskSheet repository.

## 1. Read first

Before planning or editing, read these files completely in order:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. `ARCHITECTURE.md`
4. Relevant ADRs under `docs/adr/`
5. `AGENTS.md`
6. This tool-specific `CLAUDE.md`
7. Relevant package/module README files, tests, and implementation

Authority follows that same order. `AGENTS.md` is the repository-wide engineering contract; this file is a Claude-specific implementation of it and cannot weaken or override it. Neither can override product or architecture requirements.

If documents conflict, do not choose silently. State the conflict, follow the higher-authority document, and propose an ADR or documentation change.

Read `UI-UX-SPEC.md`, `DATA-CONTRACTS.md`, `IMPLEMENTATION-PLAN.md`, and `docs/adr/ADR-0001-production-persistence-boundary.md` for the affected phase. Follow their delegated authority under the PRD/architecture. Start with facility → shift → resident → task → persisted state → preview → print. Locate actual approved visual references before claiming a match; blueprint images are explanatory only. Use proposed defaults where source samples are missing and record the visual gap explicitly.

## 2. Product guardrails

TaskSheet is a local-first, single-facility, single-workstation Windows desktop application for:

> **ORGANIZE → GENERATE → PRINT**

Never casually turn it into:

- An EHR/eMAR or authoritative clinical record
- A digital completion/productivity tracker
- A multi-workstation or cloud-synchronized product
- A staff scheduling/payroll system
- A multi-facility platform

Do not add ordinary in-app care completion controls or completion percentages. Follow-up statuses are for continuity only and must not be represented as clinical documentation.

## 3. Non-negotiable behavior

- Core workflows work offline.
- Data lives on the workstation in V2.
- Packaged production data lives in the OS application-data directory and is owned by the Electron main process. Never add renderer/browser local storage as authoritative production persistence.
- Overnight shifts use `end <= start` and explicit facility-local date windows.
- Resident selectors never default to the first resident.
- Demo/import/manual provenance remains distinguishable.
- Clearing demo data preserves manual data.
- Preview and print use the same typed document model.
- Every primary HCA/LPN sheet includes the approved guide/source-of-truth notice.
- HCA sheets do not show a dedicated Vitals/Results column by default.
- Standing FYIs never change task due/overdue counts.
- Carry-forward never resets the original due date.
- Interactive rows do not contain nested interactive elements.
- TaskSheet persists no staff/employee personal data; use role, shift, assignment-line code, and area only.

## 4. Working method

For every task:

1. Restate the requested outcome and identify the affected product rules.
2. Inspect existing implementation, tests, and repository status before editing.
3. Separate observed facts from assumptions.
4. Make the smallest cohesive change that fully solves the problem.
5. Preserve unrelated user changes; never reset or overwrite them.
6. Add or update tests at the lowest effective layer.
7. Run targeted checks, then the relevant wider suite.
8. Inspect the final diff for scope, security, accessibility, and print impact.
9. Report what changed, evidence run, and any unverified physical/hardware items.

Do not claim a live interaction, clean-machine install, physical print result, or hardware test that was not actually performed.

## 5. Architecture rules

- Keep domain code pure and platform-independent.
- Keep persistence, Electron, filesystem, and printing behind typed adapters.
- Do not implement recurrence, date, overnight, occupancy, provenance, or follow-up rules inside UI components.
- Use application services/use cases for mutations.
- Use repository interfaces rather than importing a global persistence object into every feature.
- Validate data on every trust boundary, including IPC and imports.
- Expose narrow use-case IPC only; never expose raw paths, generic file operations, unrestricted queries, or arbitrary key/value storage to the renderer.
- Maintain schema-versioned persistence and explicit migrations.
- Use SQLite transactions and the backup/restore contract in ADR-0001. Follow occurrence-based follow-up, per-resident bathing and exact wound lifecycle rules in DATA-CONTRACTS.md; do not invent alternate behavior in UI components.
- Use DATA-EXCHANGE.md for independent whole-database, wound-supply and care-task catalog exchange in CSV, Excel and JSON. Full CSV means a table ZIP; Excel means a multi-sheet workbook. Test all nine scope/format round trips, privacy isolation and failures before claiming completion.
- Never introduce direct component writes to local storage.

## 6. UI and accessibility

- Use established semantic design tokens and primitives.
- Preserve the categorized left navigation: Dashboard, Shifts, Residents, FYI Binder, Print Center, Settings.
- Keep Quick Add contextual rather than a sidebar destination.
- Provide explicit loading, empty, invalid, success, and failure states.
- Preserve keyboard access, focus visibility, accessible names/states, and touch targets.
- Do not use clickable `<tr>` or interactive ancestors containing nested buttons.
- Use natural room ordering and legible time/role labels.
- Avoid decorative polish that reduces density or scanning speed on operational screens.
- Use content-aware compact/stepped forms and separate centered attention dialogs per UI-UX-SPEC.md sections 6–9. Guard every dirty-editor exit, preserve drafts on failures, and keep only one modal focus trap active. Keep Settings and Print Center categorized with one active panel instead of a long card stack.

## 7. Print requirements

Treat print as a release surface, not an afterthought.

- Build one typed immutable document model per generated document.
- Preview and print that same model.
- Give every primary, specialized, custom, synthetic, and package output a named immutable document contract or explicit composition contract.
- Use the shared print shell and tokens.
- Repeat table headers and prevent avoidable row splits.
- Test long names, long instructions, empty sections, multi-page output, and monochrome contrast.
- Keep HCA output simpler/denser than LPN/RN.
- Record physical print as pending unless it was performed on a real printer.
- Preserve ink/paper economy: white backgrounds, thin borders, no decorative fills, no empty optional sections or unnecessary page breaks. Screen pagination must not reduce print scope; compact mode must preserve all approved content and minimum font sizes.

Approved notice:

> **This sheet is a guide only. Facility policy and the approved clinical record remain the source of truth. Report any discrepancies or unclear instructions to the team lead.**

## 8. Data and privacy

- Use fictional data in tests, screenshots, and demos.
- Do not put staff names, initials, employee numbers, usernames, contacts, schedules, attendance, payroll, credentials, performance, or completion data in schemas, fixtures, screenshots, exports, printouts, logs, or diagnostics.
- Do not copy OS usernames into TaskSheet state or ordinary support output.
- Explicit local diagnostics may transiently show a resolved path; copied/exported diagnostics always redact usernames and path roots.
- Do not add telemetry, analytics, cloud calls, or external data transfer without approved product and architecture changes.
- Avoid resident data in logs, test names, snapshots, commit messages, and support output.
- Confirm destructive actions and preserve a recovery path.
- Treat backups and exported print files as sensitive.

## 9. Testing expectations

At minimum, choose from:

- Domain unit tests
- Application/use-case tests
- Persistence and migration tests
- Component and accessibility tests
- Playwright end-to-end tests
- Build/package validation
- Physical print checklist

Boundary cases always matter: midnight, overnight end, month/year rollover, DST, inactive records, double occupancy, empty search, repeated import, cleanup by provenance, carry-forward count, long print content, and restart persistence.

Never weaken assertions to make a failure disappear. If intended behavior changed, cite the controlling requirement and update documentation/tests together.

## 10. Repository hygiene

- Inspect `git status` before and after work.
- Keep unrelated changes untouched.
- Avoid destructive Git commands.
- Do not commit secrets, generated personal data, or unnecessary build output.
- Follow existing formatting and package scripts.
- Prefer focused commits with factual messages when commits are requested.
- Do not change version numbers, tags, release designation, or installer metadata unless requested.

## 11. Completion report

End with:

- Outcome first
- Files/features changed
- Tests/checks actually run and their results
- Known limitations or verification still pending
- Any architecture/product conflict that requires a decision

Do not bury a blocker under a generic “done” summary.
