/**
 * The exact composition every IPC handler in electron/main.ts calls:
 * authorize (or authorizeAuthenticated for read/print-class operations)
 * first, then the existing pure use case. This is the single source of
 * truth for "which capability gates which operation" — main.ts contains
 * no authorization logic of its own, and these are the functions the
 * direct-IPC-equivalent tests in tests/application/authorizedUseCases.test.ts
 * call (ACCESS-CONTROL.md §4/§8).
 */
import type { Repositories } from "./ports.js";
import type { Clock } from "./clock.js";
import type { SessionManager } from "./auth/sessionManager.js";
import { authorize, authorizeAuthenticated, type AuthzDeps } from "./authorization.js";
import type { UseCaseResult } from "./result.js";
import { saveFacilitySettings, type SaveFacilitySettingsInput } from "./useCases/saveFacilitySettings.js";
import { createShift, type CreateShiftInput } from "./useCases/createShift.js";
import { createRoom, createBed, type CreateRoomInput, type CreateBedInput } from "./useCases/roomsAndBeds.js";
import { createResident, type CreateResidentInput } from "./useCases/createResident.js";
import { placeResident, type PlaceResidentInput } from "./useCases/placeResident.js";
import { createResidentTask, type CreateResidentTaskInput } from "./useCases/createResidentTask.js";
import { generateAssignmentDocument, type GenerateAssignmentDocumentInput } from "./useCases/generateAssignmentDocument.js";
import { deactivateShift, type DeactivateShiftInput } from "./useCases/deactivateShift.js";
import type { FacilitySettings, Bed, Placement, Resident, ResidentTask, Room, Shift } from "../domain/entities.js";
import type { AssignmentDocumentModel } from "../domain/generation.js";

function deps(repos: Repositories, sessions: SessionManager, clock: Clock): AuthzDeps {
  return { sessions, accounts: repos.accounts, securityEvents: repos.securityEvents, clock };
}

// --- Reads: available to every authenticated role (ACCESS-CONTROL.md §2's "View... Yes/Yes/Yes") ---

export function authorizedGetFacility(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<FacilitySettings | null> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.facility.get() };
}

export function authorizedListShifts(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<readonly Shift[]> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.shifts.listActive() };
}

export function authorizedListRooms(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<readonly Room[]> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.rooms.listActive() };
}

export function authorizedListBeds(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<readonly Bed[]> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.beds.listActive() };
}

export function authorizedListResidents(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<readonly Resident[]> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.residents.listActive() };
}

export function authorizedListPlacements(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<readonly Placement[]> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.placements.listCurrent() };
}

export function authorizedListResidentTasksForResident(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  residentId: string
): UseCaseResult<readonly ResidentTask[]> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.residentTasks.listForResident(residentId) };
}

/** Preview/print generation: ACCESS-CONTROL.md §2 grants this to every role, Viewer included. */
export function authorizedGenerateAssignment(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: GenerateAssignmentDocumentInput
): UseCaseResult<AssignmentDocumentModel> {
  const authz = authorizeAuthenticated(deps(repos, sessions, clock), senderKey);
  if (authz.kind !== "authorized") return authz;
  return generateAssignmentDocument(repos, clock, input);
}

// --- Mutations: capability-gated, default deny ---

export function authorizedSaveFacilitySettings(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: SaveFacilitySettingsInput
): UseCaseResult<FacilitySettings> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "facility.update");
  if (authz.kind !== "authorized") return authz;
  return saveFacilitySettings(repos, input);
}

export function authorizedCreateShift(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: CreateShiftInput
): UseCaseResult<Shift> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "shift.create");
  if (authz.kind !== "authorized") return authz;
  return createShift(repos, input);
}

export function authorizedDeactivateShift(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: DeactivateShiftInput
): UseCaseResult<{ shiftId: string }> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "shift.deactivate");
  if (authz.kind !== "authorized") return authz;
  return deactivateShift(repos, input);
}

export function authorizedCreateRoom(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: CreateRoomInput
): UseCaseResult<Room> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "room.create");
  if (authz.kind !== "authorized") return authz;
  return createRoom(repos, input);
}

export function authorizedCreateBed(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: CreateBedInput
): UseCaseResult<Bed> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "bed.create");
  if (authz.kind !== "authorized") return authz;
  return createBed(repos, input);
}

export function authorizedCreateResident(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: CreateResidentInput
): UseCaseResult<Resident> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "resident.create");
  if (authz.kind !== "authorized") return authz;
  return createResident(repos, input);
}

export function authorizedPlaceResident(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: PlaceResidentInput
): UseCaseResult<Placement> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "resident.place");
  if (authz.kind !== "authorized") return authz;
  return placeResident(repos, input);
}

export function authorizedCreateResidentTask(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  input: CreateResidentTaskInput
): UseCaseResult<ResidentTask> {
  const authz = authorize(deps(repos, sessions, clock), senderKey, "residentTask.create");
  if (authz.kind !== "authorized") return authz;
  return createResidentTask(repos, input);
}
