# TaskSheet V2 — Data contracts and scheduling rules

Status: implementation baseline 1, 2026-09-05. Delegated by ARCHITECTURE.md; subordinate to the controlling suite. Types below are specification sketches requiring runtime validators, not already compiled application code.

## 1. Shared types and ownership

Use opaque stable IDs; never derive identity from resident names, room labels or shift codes. LocalDate is a validated Gregorian `YYYY-MM-DD`; LocalTime is integer minutes 0–1439; Instant is UTC ISO time; Weekday is ISO 1–7; YearMonth is `YYYY-MM`. Inject the clock and use the facility IANA timezone. Persist enum values; format labels at the view boundary.

| Entity | Minimum fields and constraints |
| --- | --- |
| LocalAccount / Grant / SecurityEvent | Minimal alias/id/verifier/role/grants/state/authRevision and identity-limited audit under ACCESS-CONTROL.md; no employee profile |
| FacilitySettings | singleton facilityId; print contact fields; timezone; weekStart; reportingBasis; codeOfTheMonth; escalation threshold default 3 |
| Room / Bed | stable IDs; room label and sort key; bed label unique within room; active state |
| Resident / Placement | names, status and effective dates; residentId/bedId/start/end placement; unique current placement per resident and bed |
| Shift | id, shortCode, name, role, startMinutes, endMinutes, active, displayOrder; active code uniqueness |
| Catalog / Modifier | version, approved role requirement, duration, staff requirement, instructions; copied snapshot at assignment |
| WoundSupplyCatalogItem | stable id, itemCode, name, brand, category, size, unit, packageQuantity, supplier/item number, notes, active and provenance; reusable product only, no resident data |
| ResidentTask | id, residentId, catalog snapshot, role, eligible shift IDs, schedule, scheduleRevision, effective dates, active, visibility, optional woundId |
| UnitTask | equivalent schedule and role fields without residentId |
| FYI / Attention | id, scope, target IDs, content, effective dates, priority, dashboard/huddle flags; no task completion state |
| Wound | id, residentId, location, classification, status, effective status timestamp, history; exclusive wound registry owner |
| FollowUpOccurrence | occurrence key, taskId, scheduleRevision, immutable original due date/slot, status, count, revision and timestamps |
| BathingRequirement | residentId, effective week/date, integer showersPerWeek; never a global overwrite |
| PrintPreset | id, report type, allow-listed columns/filters/grouping/sort/density; no SQL or executable expressions |

Every seedable/importable record carries `source: manual | demo | imported` and a batch ID when source is demo/imported. Editing demo data does not silently convert provenance to manual. Cleanup previews dependencies and preserves manual references; unresolved cross-source references block deletion until reviewed. Role requirements such as LPN are configuration, not employee credential records.

## 2. Recurrence and shift inclusion

Scheduling separates cadence from placement in the day; interval and month-day tasks can therefore also have explicit times:

```ts
type Cadence =
  | { kind: "daily" }
  | { kind: "weekdays"; days: Weekday[] }
  | { kind: "interval"; everyDays: number; anchorDate: LocalDate }
  | { kind: "month_days"; days: number[] }
  | { kind: "one_time"; date: LocalDate };
type Placement =
  | { kind: "times"; minutes: number[] }
  | { kind: "period"; period: "DAY" | "EVENING" | "NIGHT" }
  | { kind: "date_only" };
type Schedule = { cadence: Cadence; placement: Placement };
```

Times/days must be unique and nonempty. Intervals are positive integer calendar-day counts; weekday arrays use 1–7 and month days use 1–31. A nonexistent month day is skipped, never silently clamped. Effective date bounds are inclusive; interval anchors do not slide when work carries forward. Ordinary generation is read-only; persisting operational follow-up occurrences is a separate idempotent application use case.

Timed occurrences use their actual facility-local calendar dates and half-open shift intervals `[start,end)`. A 2300–0700 shift on September 5 includes September 6 at 0100 and excludes September 6 at 0700. Effective dates for timed tasks use that actual occurrence date. Period/date-only tasks use the shift start date in Shift-Day mode; Calendar-Day mode explicitly splits overnight output by calendar date. Period membership is a configured field, never inferred from a code. Reject period schedules without a configured matching shift mapping.

Scheduled local times inside a DST gap move forward by the gap duration and carry a visible adjustment warning; repeated local times resolve to the earlier instant once. Resolve shift endpoints by the same policy. Preserve the original local slot as occurrence identity. Tests must document a real spring-forward and fall-back example for the selected timezone library.

An occurrence may be rendered in each explicitly configured overlapping assignment line; previews warn about overlapping assignments. A shared occurrence still has one follow-up state. Unassigned work is shown in a configuration warning, never silently assigned to the first shift. Away residents are excluded from ordinary care assignment output during their away period and remain visible in away/huddle views. Open follow-ups remain visible with an away label for review.

## 3. Follow-up occurrence contract

```ts
type FollowUpOccurrence = {
  id: string;
  taskId: string;
  scheduleRevision: number;
  originalDueDate: LocalDate;
  slotKey: string; // original local time, period, or date-only token
  status: "due" | "carry_forward" | "needs_review" | "done" | "no_longer_needed";
  carryForwardCount: number;
  revision: number;
  updatedAt: Instant;
};
type FollowUpCommand = {
  commandId: string;
  occurrenceId: string;
  expectedRevision: number;
  action: "due" | "carry_forward" | "needs_review" | "done" | "no_longer_needed" | "reopen";
};
```

Unique key: taskId + scheduleRevision + originalDueDate + slotKey. Open states may transition to any listed status; carry_forward adds exactly one, including a deliberate later carry-forward from that same state. Threshold 3 adds a review/escalation indicator; it does not mark care complete. Terminal states require an explicit `reopen` action and review reason to return to due. Reopen preserves due date/count/history. Retry command IDs return the original result before stale-revision evaluation; stale distinct commands return a conflict without mutation.

Display “Day N” as calendar days since original due date plus one, with accessible wording “N−1 days past due”; no fractional or ambiguous `4/5` display without a configured target. No automatic overnight reset. One occurrence completed on September 5 leaves September 12's recurrence independent.

A schedule edit creates a new revision from an explicit effective date. Materialized open occurrences due before that point remain for continuity. Unstarted future occurrences on the old revision become `no_longer_needed` with reason `schedule_replaced`; carried/reviewed future exceptions require preview and resolution. Terminal records remain intact. Generate new-revision occurrences without changing old keys. A legacy task-level follow-up field is migration input only; ambiguous mappings require review.

## 4. Wound links

Links require matching resident IDs and existing wound/task IDs. On heal/inactivate, atomically mark the wound status, suppress linked occurrences from that timestamp, close all still-open linked follow-ups as `no_longer_needed`/`wound_inactive`, and record an operational event with trusted actor account ID, without employee profile data. Historical terminal records and unlinked generic reminders are unchanged. A stale preview requires regeneration. Reactivating a wound does not revive tasks or follow-ups; explicit reviewed schedule reactivation creates future eligible work.

## 5. Bathing request and output

```ts
type BathingRequest = {
  facilityId: string;
  weekStart: LocalDate;
  requirements: ReadonlyArray<{ residentId: string; showersPerWeek: number }>;
  capacitySlots: ReadonlyArray<{ date: LocalDate; shiftId: string; capacity: number }>;
  lockedAssignments: ReadonlyArray<{ residentId: string; date: LocalDate; shiftId: string }>;
};
```

Require a reviewed nonnegative integer count for each selected resident; zero explicitly means no scheduled shower requirement that week. Reject duplicates, negative/fractional counts, unknown residents and invalid locks. Capacity is per date/assignment line and defaults to 2. Locks consume capacity and each resident's required count. Invalid over-capacity locks block generation. Valid but unsatisfiable demand returns a partial proposal plus unmet counts; never overbook silently.

Stable allocation baseline: preserve valid locks, then natural room/bed order plus resident ID; for each remaining shower choose an eligible slot on a distinct day maximizing separation from that resident's existing showers, breaking ties by earliest date then shift display order/ID. Requirements over available distinct days return unmet demand. Confirm commits assignments separately; generating or canceling a proposal does not save anything.

## 6. Document and command boundaries

All print models include document kind, model version, facility header snapshot, requested context, source dataset revision, explicit generatedAt, warnings, stable ordered rows, and approved notice when applicable. A supplied timestamp ensures deterministic output; builders never call the live clock. Show “Data changed—regenerate” if underlying revision changes before printing; retain the old preview as a labeled snapshot, never silently mix versions.

IPC mutations carry commandId and expected revision; validate both sides and enforce business rules in main-process application services. Authenticate and authorize the trusted session first. Return typed `unauthenticated`, `forbidden`, `validation`, `conflict`, `storage`, or `success` results. An allow-listed query returns only its view model, not the full database. Save sensitive values only in domain records required by the PRD; events record entity IDs, action/reason, time and trusted actor account ID under ACCESS-CONTROL.md, without employee profiles. Retry keys are scoped to account/installation; authorization precedes cached-result delivery.

## 7. Data exchange

Use the canonical scope/format/field and relationship rules in `DATA-EXCHANGE.md` for all nine import/export combinations. Wound supply imports operate solely on reusable product records; care-task imports operate on reusable task/modifier definitions. Whole-database logical exchange includes supported business tables and catalogs regardless of screen filters, but excludes local account/security tables under ACCESS-CONTROL.md. Imported dependencies must resolve before commit and snapshots must remain stable.
