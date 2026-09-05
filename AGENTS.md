# AGENTS.md — TaskSheet V2 Engineering Contract

These instructions apply to all automated coding agents and contributors in this repository. More specific nested `AGENTS.md` files may add local implementation guidance but may not weaken this contract or override higher-authority documents.

## 1. Authority and required reading

Read, in order:

1. `PRD.md`
2. `ARCHITECTURE-ESSENTIALS.md`
3. `ARCHITECTURE.md`
4. Applicable ADRs
5. This file
6. Tool-specific instructions such as `CLAUDE.md`
7. Relevant tests and implementation

Authority is determined by that order. If there is a material contradiction, stop silent implementation, identify it, apply the higher-authority rule, and document the needed decision.

Also read delegated companion specifications before relevant changes: `UI-UX-SPEC.md`, `DATA-CONTRACTS.md`, `IMPLEMENTATION-PLAN.md` and `docs/adr/ADR-0001-production-persistence-boundary.md`. Companion authority is defined in PRD.md; reading order does not promote them above their controlling document. Build one end-to-end workflow at a time and report acceptance IDs with actual evidence. Illustrative blueprint images are not approved screen/print references. Missing visual references allow proposed defaults, but not a claim of exact visual fidelity.

## 2. Definition of a valid change

A valid change:

- Solves the requested user outcome.
- Preserves TaskSheet’s product boundary.
- Keeps domain rules out of presentation code.
- Includes appropriate regression coverage.
- Preserves user data and unrelated working-tree changes.
- Handles empty/error/boundary states.
- Maintains accessibility and print behavior.
- Reports verification honestly.

## 3. Product boundary checks

Before implementing, ask whether the change introduces any of these:

- Clinical charting or authoritative care documentation
- Digital care completion or worker performance tracking
- Cloud/network dependency
- Multi-workstation synchronization
- Multi-facility tenancy
- New external data transmission
- Expanded resident identity on prints
- Employee profile data or account/security fields beyond the explicit ACCESS-CONTROL.md exception
- A change to overnight, due-date, backup, or provenance semantics

If yes, the change requires an approved PRD update and usually an ADR. Do not smuggle a scope change in as a UI enhancement or refactor.

## 4. Engineering rules

### Domain and application

- Prefer pure functions and explicit value types for time, dates, recurrence, status, and identifiers.
- All state mutations go through a named application use case/service.
- Preserve catalog snapshots.
- Preserve placement, provenance, follow-up, and active-date invariants.
- Keep report generation deterministic and side-effect free.
- Never parse meaning from display labels when a typed field exists.

### Persistence

- Use the repository/store abstraction; no direct feature-component persistence.
- Production engine is SQLite per ADR-0001. Use transactional mutations, safe snapshot backups and validated migrations; never copy only the live database file as a backup.
- In packaged production, use only main-process-owned persistence in the OS application-data directory. Renderer/browser local storage is allowed only for isolated development/testing or controlled legacy migration and is never authoritative.
- Expose narrow, typed, validated persistence use cases through preload IPC; never expose raw filesystem paths, unrestricted database access, or a generic key/value bridge.
- Persist a schema version and migrate one version at a time.
- Validate before and after migration/import.
- Ensure write/restore/import is atomic or safely recoverable.
- Never use an export or network path as the live store.
- Never delete broad application-data paths without exact resolution, confirmation, and recovery planning.

### Desktop security

- Keep renderer privileges minimal.
- Use typed allow-listed IPC.
- Validate privileged payloads.
- Do not enable Node integration in the renderer.
- Do not add shell execution, arbitrary filesystem access, or uncontrolled external navigation.
- Never commit credentials or personal facility data.

### UI

- Reuse design-system tokens and components.
- Do not nest interactive controls.
- Preserve keyboard, screen-reader, focus, and touch behavior.
- Use explicit empty/loading/error states.
- Resident lookup starts empty and requires deliberate selection.
- Keep operational surfaces dense, calm, and scannable.
- Apply UI-UX-SPEC.md sections 6–9: content-aware stepped forms, separate centered attention dialogs, shared dirty-exit guards and categorized Print Center/Settings. Do not implement a long form by merely adding overflow scrolling or embed consequential warnings inside form content.
- For data exchange, read DATA-EXCHANGE.md and UI-UX-SPEC.md section 10. Implement both directions for all three scopes and all three formats; preserve relationships, scope isolation, snapshots and safe previews. Never substitute a current-page CSV report for a whole-database export.

### Print

- Print and preview share a typed immutable document model.
- Reuse the common print shell.
- Preserve approved columns and notice text.
- Give every primary, specialized, custom, synthetic, and package output a named immutable document model or explicit composition contract.
- Verify pagination, long content, empty sections, monochrome, and page headers/footers.
- Do not claim physical certification from browser/PDF inspection alone.
- Enforce white-background low-ink output, compact paper use and complete print scope independent of screen pagination. Never trade away mandatory information, legibility or handwriting space to reduce pages.

## 5. Change workflow

1. Inspect repository instructions and status.
2. Locate the source of truth and existing tests.
3. Write a brief implementation/verification plan for non-trivial work.
4. Reproduce defects before fixing when practical.
5. Implement the smallest complete change.
6. Add regression tests.
7. Run targeted tests and relevant project gates.
8. Review the diff for scope and accidental data/API changes.
9. Report actual evidence and remaining gaps.

Agents may parallelize independent read-only analysis or clearly separated work only when coordination will not cause overlapping edits. One owner should integrate and validate the final result.

## 6. Commands and repository discovery

- Prefer repository-defined scripts in `package.json` or documented tooling.
- Use fast scoped search (`rg`, `rg --files`) before broad traversal.
- Do not invent successful command results.
- Avoid destructive Git operations and broad file deletion.
- Do not overwrite unrelated changes in a dirty worktree.
- Do not modify generated artifacts when their source is available; update the source and regenerate.

## 7. Required verification matrix

Use the smallest set that credibly covers the change, expanding for release work.

| Change area | Required minimum |
| --- | --- |
| Pure domain rule | Unit tests including boundaries |
| Persistence/schema | Round trip, migration, failure/recovery tests |
| Production storage boundary | Main-process ownership, empty/non-authoritative browser storage, validated IPC, restart persistence |
| Import/export/demo | Preview/commit, provenance, repeated operation, cleanup isolation |
| React UI | Component behavior plus keyboard/accessibility checks |
| Navigation | Route registry test and E2E navigation |
| Dashboard/huddle | Read-model tests, visibility/priority/effective-date cases |
| Follow-up | Transition, immutable due date, increment/escalation tests |
| Printing | Document-model tests, preview parity, render inspection |
| Specialized/custom printing | Named-model coverage, privacy filters, resident-free synthetic output, package parity |
| Overnight scheduling | Start/end boundaries, next-day inclusion, month/year rollover |
| Packaging/release | Full gates, installer, clean-machine, restart, backup restore, physical print |

## 8. Test data

- Use clearly fictional facilities and residents.
- Never copy production resident data into fixtures, snapshots, screenshots, logs, or issues.
- No employee profiles, real credentials or OS account names in fixtures. Fictional local login aliases/verifier fixtures are permitted solely for auth tests under ACCESS-CONTROL.md. Care output uses role and assignment-line codes.
- Read ACCESS-CONTROL.md and ADR-0002; enforce CRUD/role permissions in main-process services, not just UI. Test direct IPC, lifecycle bypasses, session revocation, last-admin protection and security exclusions during transfer. Auth is phase-1 work.
- Include realistic edge cases: custom room labels, double occupancy, short shifts, overnight shifts, inactive tasks, healed wounds, long instructions, and no-results states.
- Make time-dependent tests use an injected/fixed clock and explicit facility timezone.

Verify occurrence-level follow-up retry safety, per-resident bathing counts, deterministic wound-healing suppression, and redacted exported paths. Actual resolved paths may appear only transiently in the explicit local diagnostic view. Persist no OS username in logs/support bundles. Record unavailable hardware checks as pending and continue independent phases; pending physical verification blocks release readiness, not unrelated implementation.

## 9. Release discipline

- Release designations are evidence-based.
- A tag and packaged installer should correspond to one immutable verified commit.
- Checksums are recorded after packaging and must not be regenerated without acknowledging a new artifact.
- P0/P1 defects, unsafe migrations, demo ambiguity, or missing mandatory validation block production-ready status.
- Hardware and physical-print checks remain explicitly pending until performed.

## 10. ADR requirement

Create or propose an ADR for durable choices involving storage engine, synchronization, external integrations, time semantics, print model, privacy identity, backup format, security boundary, or major module ownership.

ADR template:

```md
# NNNN — Decision title

Status: Proposed | Accepted | Superseded
Date: YYYY-MM-DD

## Context
## Decision
## Alternatives considered
## Consequences
## Migration and rollback
## Tests and documents affected
```

An ADR cannot override the PRD or Architecture Essentials. Amend the controlling document explicitly when necessary.

## 11. Done criteria

Work is done only when:

- The requested behavior is implemented or the requested analysis is complete.
- Relevant tests pass.
- Type/lint/build checks appropriate to the scope pass.
- No unrelated changes were overwritten.
- Accessibility, privacy, offline, persistence, and print impacts were considered.
- The final report distinguishes verified facts from pending verification.
