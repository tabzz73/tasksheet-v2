/**
 * Pure read-model generation pipeline (ARCHITECTURE-ESSENTIALS.md §7).
 * Source data + configuration + date + shift + role -> deterministic,
 * typed, immutable AssignmentDocumentModel. No I/O, no live clock reads:
 * `generatedAt` and `sourceDatasetRevision` are supplied by the caller.
 */
import { computeShiftWindow, instantInWindow, localDateTimeToInstant } from "./time.js";
import { cadenceMatches } from "./schedule.js";
import type {
  Bed,
  FacilitySettings,
  Placement,
  Resident,
  ResidentTask,
  Room,
  Shift
} from "./entities.js";
import { formatHHmm, type Id, type Instant, type LocalDate } from "./types.js";

export const GUIDE_NOTICE =
  "This sheet is a guide only. Facility policy and the approved clinical record remain the source of truth. Report any discrepancies or unclear instructions to the team lead.";

export interface AssignmentRow {
  readonly taskId: Id;
  readonly occurrenceKey: string;
  readonly time: string | null; // HHmm, or null for date-only/period placement
  readonly room: string;
  readonly residentFirstName: string;
  readonly residentLastName: string;
  readonly taskName: string;
  readonly importantInformation: string | null;
}

export interface FacilityHeaderSnapshot {
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly mainPhone: string;
  readonly nursingPhone: string | null;
  readonly fax: string | null;
}

export interface AssignmentDocumentModel {
  readonly kind: "hca-assignment" | "lpn-assignment";
  readonly modelVersion: 1;
  readonly facilityHeader: FacilityHeaderSnapshot;
  readonly requestedContext: {
    readonly date: LocalDate;
    readonly shiftId: Id;
    readonly shiftName: string;
    readonly shiftShortCode: string;
    readonly role: "HCA" | "LPN";
    readonly generatedAt: Instant;
    readonly sourceDatasetRevision: number;
  };
  readonly warnings: readonly string[];
  readonly rows: readonly AssignmentRow[];
  readonly notice: typeof GUIDE_NOTICE;
}

export interface GenerateAssignmentDocumentInput {
  facility: FacilitySettings;
  shift: Shift;
  date: LocalDate;
  residents: readonly Resident[];
  placements: readonly Placement[];
  beds: readonly Bed[];
  rooms: readonly Room[];
  tasks: readonly ResidentTask[];
  generatedAt: Instant;
  sourceDatasetRevision: number;
}

function currentPlacementFor(residentId: Id, placements: readonly Placement[], date: LocalDate): Placement | null {
  const active = placements.filter(
    (p) => p.residentId === residentId && p.startDate <= date && (p.endDate === null || p.endDate >= date)
  );
  return active[0] ?? null;
}

function roomLabelForBed(bedId: Id, beds: readonly Bed[], rooms: readonly Room[]): string {
  const bed = beds.find((b) => b.id === bedId);
  if (!bed) return "Unassigned";
  const room = rooms.find((r) => r.id === bed.roomId);
  const roomLabel = room ? room.label : "?";
  return bed.label ? `${roomLabel}` : roomLabel;
}

/**
 * Naturally-sortable room key: splits leading letters/digits so "L101" <
 * "101A" < "101B" sorts the way staff expect rather than lexically.
 */
export function naturalRoomSortKey(label: string): string {
  return label
    .toUpperCase()
    .replace(/(\d+)/g, (digits) => digits.padStart(6, "0"));
}

export function generateAssignmentDocument(input: GenerateAssignmentDocumentInput): AssignmentDocumentModel {
  const { facility, shift, date, residents, placements, beds, rooms, tasks, generatedAt, sourceDatasetRevision } =
    input;
  const window = computeShiftWindow(shift, date, facility.timeZone);
  const candidateDates: readonly LocalDate[] = window.isOvernight ? [date, window.endDate] : [date];

  const warnings: string[] = [];
  const rows: AssignmentRow[] = [];

  for (const task of tasks) {
    if (!task.active) continue;
    if (task.role !== shift.role) continue;
    if (!task.eligibleShiftIds.includes(shift.id)) continue;
    if (task.activeFrom > date) continue;
    if (task.activeTo !== null && task.activeTo < date) continue;

    const resident = residents.find((r) => r.id === task.residentId);
    if (!resident) continue;
    if (resident.status !== "active") continue; // away/inactive residents excluded from ordinary output

    const placement = currentPlacementFor(resident.id, placements, date);
    if (!placement) {
      warnings.push(`${resident.firstName} ${resident.lastName} has no current bed placement; task "${task.catalog.name}" omitted.`);
      continue;
    }
    const room = roomLabelForBed(placement.bedId, beds, rooms);

    if (task.schedule.placement.kind === "times") {
      for (const minutes of task.schedule.placement.minutes) {
        for (const occurrenceDate of candidateDates) {
          if (!cadenceMatches(task.schedule.cadence, occurrenceDate)) continue;
          const instant = localDateTimeToInstant(occurrenceDate, minutes, facility.timeZone);
          if (!instantInWindow(instant, window)) continue;
          rows.push({
            taskId: task.id,
            occurrenceKey: `${task.id}:${task.scheduleRevision}:${occurrenceDate}:${formatHHmm(minutes)}`,
            time: formatHHmm(minutes),
            room,
            residentFirstName: resident.firstName,
            residentLastName: resident.lastName,
            taskName: task.catalog.name,
            importantInformation: task.importantInformation
          });
        }
      }
    } else if (task.schedule.placement.kind === "date_only") {
      if (!cadenceMatches(task.schedule.cadence, date)) continue;
      rows.push({
        taskId: task.id,
        occurrenceKey: `${task.id}:${task.scheduleRevision}:${date}:date_only`,
        time: null,
        room,
        residentFirstName: resident.firstName,
        residentLastName: resident.lastName,
        taskName: task.catalog.name,
        importantInformation: task.importantInformation
      });
    } else {
      warnings.push(
        `Task "${task.catalog.name}" for ${resident.firstName} ${resident.lastName} uses period placement, which requires a configured shift/period mapping not yet implemented; occurrence omitted rather than guessed.`
      );
    }
  }

  rows.sort((a, b) => {
    const roomCompare = naturalRoomSortKey(a.room).localeCompare(naturalRoomSortKey(b.room));
    if (roomCompare !== 0) return roomCompare;
    const timeCompare = (a.time ?? "").localeCompare(b.time ?? "");
    if (timeCompare !== 0) return timeCompare;
    return a.occurrenceKey.localeCompare(b.occurrenceKey);
  });

  return {
    kind: shift.role === "HCA" ? "hca-assignment" : "lpn-assignment",
    modelVersion: 1,
    facilityHeader: {
      name: facility.name,
      addressLine1: facility.addressLine1,
      addressLine2: facility.addressLine2,
      mainPhone: facility.mainPhone,
      nursingPhone: facility.nursingPhone,
      fax: facility.fax
    },
    requestedContext: {
      date,
      shiftId: shift.id,
      shiftName: shift.name,
      shiftShortCode: shift.shortCode,
      role: shift.role,
      generatedAt,
      sourceDatasetRevision
    },
    warnings,
    rows,
    notice: GUIDE_NOTICE
  };
}
