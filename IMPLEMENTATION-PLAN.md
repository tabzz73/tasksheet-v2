# TaskSheet V2 — Agent implementation and acceptance plan

Status: implementation baseline 4, 2026-09-05. Includes user-approved local accounts and CRUD permissions under ACCESS-CONTROL.md/ADR-0002. No application implementation was performed in this documentation revision.

## 1. Agent starting instructions

Read PRD.md, ARCHITECTURE-ESSENTIALS.md, ARCHITECTURE.md, the ADRs, DATA-CONTRACTS.md, UI-UX-SPEC.md, this plan, AGENTS.md and tool-specific instructions before implementation. Reading order does not change their documented authority. Inspect actual repository/runtime state before claiming a feature exists. Preserve unrelated work and do not replace a working application wholesale without a reason grounded in evidence.

Build one complete end-to-end workflow at a time. Match inspected approved UI/print references; where unavailable, use the proposed defaults and explicitly record visual fidelity as unverified. Do not infer features from illustrative diagrams. Raise actual product conflicts with a concrete proposed disposition while continuing independent authorized work. Do not repeatedly ask permission for routine implementation choices already covered by the baseline.

## 2. Delivery phases

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 — Establish reality | Inventory source, package scripts/versions, existing storage keys/schema, active release status, available references; choose/pin SQLite binding compatible with actual Electron | Gap/decision register; packaged SQLite open/transaction/backup smoke result; no invented dependency versions |
| 1 — First complete workflow | First Administrator enrollment/login → facility → shift → resident/bed → task → SQLite → preview/print; HCA/LPN profiles, Editor/Viewer and enforced access checks | AC-01–05 plus AC-44–49 and AC-52–53; offline restart; physical print performed or explicitly pending |
| 2 — Domain breadth | Multiple rooms/beds, short/overnight shifts, recurrence, modifiers, unit tasks, date/status eligibility | AC-06–10 and migration fixtures |
| 3 — Operational visibility | FYIs, attention, dashboard customization, huddle, Code of Month, occurrence-based follow-up | AC-11–14; no ordinary care completion controls |
| 4 — Wounds and bathing | Single wound registry, lifecycle propagation, per-resident bathing proposal/confirmation | AC-15–17 |
| 5 — Full Print Center | Binder changes, wound output, 7-day lookahead, shift reference, blank/calibration, custom reports and packages | AC-18–20; each PRD output mapped to model and route; no dead actions |
| 6 — Data recovery and release | Demo/import isolation, backup/restore, legacy migration, installer and clean-machine validation | AC-21–25 plus full relevant build/test gates and physical certification |

Security, accessibility, privacy, transactions and offline operation apply from phase 1, not as a final hardening exercise. Later independent phases may proceed while physical hardware is unavailable; pilot/production readiness cannot be claimed until required physical evidence exists.

Implement the shared contextual editor, centered attention dialog and dirty-exit guard in phase 1 and reuse them in later phases. Phase 1 additionally covers AC-26–30 and AC-34–35; phase 5 covers AC-31–33 and AC-36. Paper/ink economy and bounded navigation apply to every relevant phase.

## 3. Acceptance scenarios

Use fictional fixtures and a fixed facility timezone/clock. These are expected results, not passed-test claims.

| ID | Given / When | Then |
| --- | --- | --- |
| AC-01 | Clean profile, no demo selected; complete setup | Facility persists; no fictional operational records silently appear |
| AC-02 | One bed, resident, 0700–1500 HCA shift and 0900 task; generate | Exactly one eligible task, correct resident/room/time, HCA columns and notice |
| AC-03 | Equivalent LPN assignment; preview then print | Shared content snapshot; Vitals/Results and Notes space; no task-completion mutation |
| AC-04 | Save data, close app, clear renderer web storage, restart offline | Main-process SQLite retains all committed records |
| AC-05 | Long resident/instructions span pages; print Actual Size | No clipping/truncation; headings and footer repeat; readable handwriting space |
| AC-06 | Shift 2300–0700 on September 5; tasks at 2300, 0100 and 0700 | First two included on correct dates; end-boundary 0700 excluded |
| AC-07 | Interval anchored Jan 31 every 14 days; carry one occurrence | Cadence stays anchored; future dates do not slide |
| AC-08 | Month-day 31 schedule in February; real DST transition fixtures | February slot skipped; DST gap/fold follows documented adjustment and deduplication |
| AC-09 | Rooms L101, 101A, 101B with two occupied beds; attempt duplicate placement | Natural stable ordering; conflicting placement rejected atomically |
| AC-10 | Resident away/inactive, task inactive, task outside assigned shift | Current ordinary sheet excludes ineligible care; warnings/away view explain relevant exclusions |
| AC-11 | Hide every dashboard widget, reload | Preferences persist; explanatory empty state with Customize |
| AC-12 | FYI shared at facility/role/shift scopes; generate binder and huddle | Scope deduplication and visibility respected; no FYI due counts |
| AC-13 | Complete one recurring follow-up; create next occurrence; retry same carry command | Next occurrence remains independent; count increments once per command; due date unchanged |
| AC-14 | Code of Month disabled/expired; dashboard/huddle | No stale code; configured-empty state; no fabricated emergency guidance |
| AC-15 | Wound linked to task/open follow-up plus an unlinked reminder; heal | Linked future work suppressed and open follow-up closed with reason; unlinked reminder/history preserved |
| AC-16 | Reactivate that wound | No old work automatically revived; explicit linked-schedule review required |
| AC-17 | Residents require 1 and 2 showers, capacity 2 per slot, valid locks; regenerate | Individual counts respected; deterministic proposal; unmet demand explicit; Cancel makes no writes |
| AC-18 | Open every specialized Print Center output | Named model and working preview; blank/calibration contain no resident data |
| AC-19 | Custom report requests forbidden/unavailable fields or filter bypass | Validation rejects; no SQL/expression injection; privacy/date/role rules retained |
| AC-20 | Package preview, then source data edited before print | Stale snapshot warning; regenerate explicitly; no mixed revisions |
| AC-21 | Demo and manual records coexist; clear demo | Preview scoped dependencies; manual data preserved; residual demo configuration reviewed |
| AC-22 | Backup with committed data in WAL; restore; corrupted/unknown backup | Valid backup round-trips; invalid backup leaves active store unchanged |
| AC-23 | Interrupted migration/restore, then relaunch | Recover old or validated new store; never silently seed or erase; repeated migration idempotent |
| AC-24 | Actual user-data path contains a username; view locally then copy support report | Local requested view may resolve path; copied/exported text contains redacted tokens only |
| AC-25 | Install in clean Windows profile; reinstall and restore inactive external backup | Document actual paths/retention without usernames in exported evidence; confirm offline operation and user separation |
| AC-26 | Add Resident and Add Task at 1280×800, then narrow viewport and 200% zoom | Common desktop steps fit without routine scrolling; fallback scrolling keeps every field/action reachable; no nested scroll traps |
| AC-27 | Enter task details, move across steps, change type/role | Draft retained; applicable fields only; incompatible-data clearing requires centered confirmation; review links reach each step |
| AC-28 | Dirty editor; try Cancel, X, Escape, backdrop, navigation and normal app close | Separate centered discard dialog; Keep editing/Escape preserves values/focus; explicit Discard abandons only that draft; pristine editor closes directly |
| AC-29 | Submit invalid resident/task or simulate save failure | Centered summary/error is separate from form; local field hints remain; Review fields focuses the correct step; draft preserved and no false success |
| AC-30 | Open attention dialog over form and trigger repeated errors | Exactly one active focus trap; background inert; safe default action; repeated errors coalesced; keyboard and focus return work |
| AC-31 | Navigate Settings/Print Center with many entries; search then return | One selected category, compact paged list and preserved context; no long expanded card wall; unsaved settings protected |
| AC-32 | 60 matching rows with page size 25; select All matching results and print/export | All 60 eligible selected rows included; This page is separately labeled; no DOM/page-limited output |
| AC-33 | Multi-page preview of a package | Page count/navigation works without scrolling the entire preview; no configuration form embedded below all pages |
| AC-34 | Standard/Compact HCA and LPN output with long content | White backgrounds, no decorative fills/chrome/dialogs; fonts, instructions, notices and handwriting areas preserved; extra pages allowed when needed |
| AC-35 | Edit then revert values; cancel; request exit while save is pending | Reverted form is clean; pending save resolves before exit; no double submission or false undo of committed work |
| AC-36 | Package has accidental duplicate requests and intentional repeated shift content | Review removes only chosen duplicate documents; standalone shift sheets retain necessary repeated information; no task occurrences dropped |

## 4. Evidence and handoff

For each phase record: controlling requirement IDs, changed modules, tests actually executed with results, screenshots/artifact references, source commit/build identity, failures and remaining gaps. Distinguish Implemented, Automated verified, Visual reviewed, Physical verified, and Pending. Test counts from previous releases are not evidence for this build.

Before a release claim, run repository-defined type/lint/build gates and relevant unit/application/adapter/component/E2E tests, certify physical output, verify installer/restart/backup recovery and close release blockers. Do not alter immutable release tags or old installer checksums to hide a corrected build.

## 5. Remaining evidence and choices

- SQLite engine is selected; exact binding and pinned runtime compatibility must be verified against the real repository in phase 0.
- Proposed screen dimensions/print metrics require review against located source references or first-build samples.
- Legacy schema mappings require inspection of actual files; never invent a migration from memory.
- Hardware print, Windows clean-machine and installer results remain pending until executed.

These are bounded implementation/verification tasks, not permission to invent product scope or postpone all useful work.

## 5.1 Access-control gates

Read ACCESS-CONTROL.md and ADR-0002 with the initial suite. Phase 0 inventories any existing authentication safely; phase 1 implements accounts, first-admin bootstrap, secure password storage, sessions, main-process CRUD enforcement and permission-aware UI. Phase 6 adds full native/logical restore identity-policy tests AC-50–51. Do not defer authentication until release packaging.

## 6. Scoped data exchange delivery

Read DATA-EXCHANGE.md before persistence/exchange work. Implement catalog types and scope isolation with their owning modules; phase 6 must complete all nine scope/format import/export pairs and the Data Management wizard. Supply canonical templates, third-party catalog mapping, conflict preview, verified pre-replacement backup and round-trip evidence. Native backup alone does not satisfy CSV/Excel/JSON whole-database exchange.

| ID | Given / When | Then |
| --- | --- | --- |
| AC-37 | Export/import Whole Database through CSV package, Excel and JSON | All logical tables, history, IDs, links, settings and provenance round-trip; no screen-filter truncation |
| AC-38 | Export/import each catalog separately through all three formats | Correct catalog and dependencies only; no residents/clinical records or unrelated scope mutation; all nine combinations covered with AC-37 |
| AC-39 | Edit catalog items, preview add/update or replace, reimport same file | Conflicts reviewed; unchanged records not duplicated; omitted referenced entries deactivated safely; existing snapshots unchanged |
| AC-40 | Leading zeros, HHmm, Unicode, multiline text, nulls and formula-like text | Logical values preserved; Excel cells literal; CSV escaping reversible; no executable spreadsheet content |
| AC-41 | Missing table/link, duplicate ID, prohibited scope data or future schema | Paged correction report and centered blocking summary; active database unchanged |
| AC-42 | Whole import replaces facility data; interrupt activation or cancel before commit | Explicit confirmation and verified backup required; safe old/new recovery; no cross-facility merge or partial import |
| AC-43 | Large/malformed archive/workbook, stale preview or disk-full export | Bounded parsing, safe rejection, preserved selections/data; no false success or broken artifact presented as complete |
| AC-44 | Clean/legacy first run; restart offline after admin enrollment | No default credentials; recognized bootstrap only; auth persists and restart requires login; no protected data before sign-in |
| AC-45 | Administrator, Editor and Viewer attempt every matrix action through UI and direct IPC | Role/capability defaults enforced in main process; Viewer cannot mutate; hidden controls are not the sole protection |
| AC-46 | Editor lacks archive/delete grant but changes status/imports/calls a lifecycle command | Forbidden operation rejected with unchanged data; legitimate updates still work; granting exact capability enables only that operation |
| AC-47 | Disable/demote last admin, including concurrent commands | Last enabled Administrator retained transactionally; no self-escalation through forged actor/role payloads |
| AC-48 | Failed logins, password reset/change, recovery code and repeat recovery attempt | Salted Argon2id, persistent delays, forced change/revocation and single-use recovery work; no secret leakage or backdoor |
| AC-49 | Dirty editor hits idle/OS lock, then another account signs in; permissions revoked mid-preview | Data obscured; same-user-only draft recovery; no cross-user cache; stale session/preview denied |
| AC-50 | Export/import every logical format and both catalogs after accounts exist | No accounts/grants/secrets/security audit transferred; source actor IDs sanitized; business round trip retained; files cannot create an admin |
| AC-51 | Native backup normal restore then fresh-machine disaster recovery | Admin-only backup; normal restore retains current policy; fresh recovery authenticates against backup before activation; no silent password/grant rollback |
| AC-52 | Protected CRUD or bulk mutation succeeds/fails; attempt to edit audit | Trusted actor and action recorded transactionally without clinical payloads; no audit editing or cleanup bypass |
| AC-53 | Viewer prints/saves PDF, tries CSV export or shared preset save; Editor gains then loses scope grant | Print remains allowed; file transfer/shared mutation denied; grants enforced per action and revocation invalidates replay/results |
