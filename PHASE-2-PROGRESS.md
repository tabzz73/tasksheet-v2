# TaskSheet V2 — Phase 2 Progress (Domain Breadth)

Phase 2 per IMPLEMENTATION-PLAN.md: "Multiple rooms/beds, short/overnight
shifts, recurrence, modifiers, unit tasks, date/status eligibility" —
AC-06 through AC-10.

## Already met, carried from Phase 1 work (verified, not re-implemented here)

Inspection of the existing domain layer before starting Phase 2 work found
these were already implemented and tested during Phase 1, ahead of the
phase boundary:

- **AC-06 (overnight shifts)** — `computeShiftWindow`/`instantInWindow` in
  `src/domain/time.ts` implement the half-open `[start, end)` window with
  `endMinutes <= startMinutes` treated as overnight, ending on `D+1`.
  Tested in `tests/domain/time.test.ts`.
- **AC-07 (interval cadence, anchored)** — `cadenceMatches`'s `interval`
  branch in `src/domain/schedule.ts` computes `daysBetween(anchorDate,
  date) % everyDays === 0`, so the anchor never slides. The calendar half
  of AC-08 (`month_days` day 31 never matching in February) falls out of
  the same mechanism, since `cadenceMatches` is only ever asked about real
  calendar dates — a nonexistent day is simply never queried, never
  clamped.
- **AC-09 (natural room ordering, occupancy conflicts)** —
  `naturalRoomSortKey` in `src/domain/generation.ts` pads embedded digits
  for correct natural sort; `tests/persistence/roundtrip.test.ts` proves a
  second concurrent placement for the same resident, and a second
  concurrent occupant for the same bed, are both rejected atomically at
  the persistence boundary.
- **AC-10 (exclusions)** — `generateAssignmentDocument` in
  `src/domain/generation.ts` excludes inactive tasks, tasks outside the
  assigned shift, and away/inactive residents (with a warning rather than
  a silent drop for a resident lacking a current placement). Tested in
  `tests/domain/generation.test.ts`.

## Closed this pass

- **AC-08 (DST gap/fold precision)** — this was the one deliberately
  deferred item from the Phase 1 pass (documented in `src/domain/time.ts`'s
  header comment as "not yet implemented... must not be claimed as
  implemented until covered by the required real spring-forward/fall-back
  fixtures"). Implemented in `src/domain/time.ts`:
  - `resolveLocalDateTime(date, minutes, timeZone)` replaces the old
    single-offset guess with a bracket-based disambiguation: it takes a
    first-pass offset guess to anchor near the true instant, then samples
    the real UTC offset ±2 hours around that anchor (safely wider than any
    real DST shift) to detect whether a transition is nearby. If both
    samples agree, the wall time is unambiguous. If they disagree, each
    candidate instant's real local rendition is checked against the
    requested wall time: both matching means a fall-back **fold** (resolved
    to the earlier of the two real instants, deterministically, every
    time); neither matching means a spring-forward **gap** (resolved by
    moving forward by the gap duration, per DATA-CONTRACTS.md §2); exactly
    one matching is the ordinary case landing right at a boundary.
  - `localDateTimeToInstant` (used by `computeShiftWindow` for shift
    start/end) now forwards to `resolveLocalDateTime`, so shift endpoints
    are resolved by the same policy the spec requires ("Resolve shift
    endpoints by the same policy").
  - `generateAssignmentDocument` in `src/domain/generation.ts` now uses
    `resolveLocalDateTime` for timed occurrences and pushes a visible
    warning into the document's `warnings` array when an occurrence's
    scheduled time was gap-adjusted — the row itself still displays the
    original nominal HH:mm ("Preserve the original local slot as
    occurrence identity"), only the underlying instant used for shift-window
    membership is adjusted.
  - `tests/domain/dst.test.ts` — 9 tests against the **real** America/Denver
    2026 transitions (spring-forward 2026-03-08 02:00→03:00 MST→MDT;
    fall-back 2026-11-01 02:00→01:00 MDT→MST), the required real fixtures
    per DATA-CONTRACTS.md §2: gap-adjustment of a nonexistent wall time and
    its exact forward-shifted instant; fold resolution of an ambiguous wall
    time to the earlier instant, proven deterministic across repeated
    calls; boundary wall times immediately outside each transition resolve
    normally; a full `generateAssignmentDocument` run proves occurrence
    identity is preserved (row still shows "0230", not "0330") and the
    gap warning is surfaced; and an overnight shift whose end lands on the
    fold-ambiguous wall time still produces a correctly ordered half-open
    window.

Evidence: `npx vitest run` — 113/113 passing (104 carried + 9 new DST
tests); `npm run lint` clean; `tsc --noEmit` clean on both configs.

## Not yet started (remaining Phase 2 scope)

- **Unit Tasks (PRD.md §12.2)** — non-resident routines tied to a role or
  shift rather than a specific resident (start-of-shift checks, handoff,
  fridge temperature, unit safety routines). No domain entity, migration,
  repository, use case, IPC surface, editor UI, or generation-pipeline
  inclusion exists for this yet — `ResidentTask` currently requires a
  `residentId` unconditionally. This is a genuinely new feature surface
  (schema + domain + application + UI + print-model inclusion), not a bug
  fix, and has not been started in this pass.
- **Modifiers (PRD.md §13)** — stackable modifiers changing added workload
  minutes, minimum staff count, credential requirement, or printed
  instruction. Not implemented; `ResidentTask.catalog` currently carries
  only a flat name/category/instructions snapshot with no modifier layer.
- **Migration fixtures** for whatever schema changes Unit Tasks/modifiers
  require, once designed.

These three remaining items are each substantial standalone features
(schema + domain + application + UI), not small gap-closures, and have
intentionally not been started speculatively in this pass without more
specific direction on scope and UI placement.
