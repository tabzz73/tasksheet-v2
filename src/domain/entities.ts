/**
 * Minimum domain entity shapes needed for the phase-1 first workflow
 * (facility -> shift -> resident/bed -> task -> generation). See
 * DATA-CONTRACTS.md §1 for the full target field set; fields not required by
 * the first workflow are intentionally omitted rather than stubbed.
 */
import type { Id, LocalDate, LocalTime, Provenance, Role } from "./types.js";
import type { Schedule } from "./schedule.js";

export interface FacilitySettings {
  facilityId: Id;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  mainPhone: string;
  nursingPhone: string | null;
  fax: string | null;
  timeZone: string;
  weekStart: 1 | 7;
  escalationThreshold: number;
}

export interface Room {
  id: Id;
  label: string;
  sortKey: string;
  active: boolean;
}

export interface Bed {
  id: Id;
  roomId: Id;
  label: string;
  active: boolean;
}

export type ResidentStatus = "active" | "in_hospital" | "out_on_pass" | "moved_out" | "deceased";

export interface Resident {
  id: Id;
  firstName: string;
  lastName: string;
  status: ResidentStatus;
  source: Provenance;
  sourceBatchId: string | null;
}

export interface Placement {
  id: Id;
  residentId: Id;
  bedId: Id;
  startDate: LocalDate;
  endDate: LocalDate | null;
}

export interface Shift {
  id: Id;
  shortCode: string;
  name: string;
  role: Role;
  startMinutes: LocalTime;
  endMinutes: LocalTime;
  active: boolean;
  displayOrder: number;
}

export interface CatalogSnapshot {
  catalogItemId: Id;
  version: number;
  name: string;
  category: string;
  instructions: string;
}

export interface ResidentTask {
  id: Id;
  residentId: Id;
  role: Role;
  eligibleShiftIds: readonly Id[];
  schedule: Schedule;
  scheduleRevision: number;
  activeFrom: LocalDate;
  activeTo: LocalDate | null;
  active: boolean;
  catalog: CatalogSnapshot;
  importantInformation: string | null;
  showOnPrint: boolean;
  source: Provenance;
  sourceBatchId: string | null;
}
