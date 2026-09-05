/**
 * The complete, allow-listed renderer <-> main IPC surface. This is the only
 * contract the renderer may rely on — no raw filesystem paths, no generic
 * query/key-value bridge (ARCHITECTURE-ESSENTIALS.md §3.1/§4).
 */
import type { FacilitySettings, Bed, Placement, Resident, ResidentTask, Room, Shift } from "../domain/entities.js";
import type { AssignmentDocumentModel } from "../domain/generation.js";
import type { UseCaseResult } from "../application/result.js";
import type { SaveFacilitySettingsInput } from "../application/useCases/saveFacilitySettings.js";
import type { CreateShiftInput } from "../application/useCases/createShift.js";
import type { CreateRoomInput, CreateBedInput } from "../application/useCases/roomsAndBeds.js";
import type { CreateResidentInput } from "../application/useCases/createResident.js";
import type { PlaceResidentInput } from "../application/useCases/placeResident.js";
import type { CreateResidentTaskInput } from "../application/useCases/createResidentTask.js";
import type { GenerateAssignmentDocumentInput } from "../application/useCases/generateAssignmentDocument.js";

export const IPC_CHANNELS = {
  facilityGet: "facility:get",
  facilitySave: "facility:save",
  shiftList: "shift:list",
  shiftCreate: "shift:create",
  roomList: "room:list",
  roomCreate: "room:create",
  bedList: "bed:list",
  bedCreate: "bed:create",
  residentList: "resident:list",
  residentCreate: "resident:create",
  placementList: "placement:list",
  placementCreate: "placement:create",
  residentTaskListForResident: "residentTask:listForResident",
  residentTaskCreate: "residentTask:create",
  assignmentGenerate: "assignment:generate"
} as const;

export interface TasksheetApi {
  facility: {
    get(): Promise<FacilitySettings | null>;
    save(input: SaveFacilitySettingsInput): Promise<UseCaseResult<FacilitySettings>>;
  };
  shifts: {
    list(): Promise<readonly Shift[]>;
    create(input: CreateShiftInput): Promise<UseCaseResult<Shift>>;
  };
  rooms: {
    list(): Promise<readonly Room[]>;
    create(input: CreateRoomInput): Promise<UseCaseResult<Room>>;
  };
  beds: {
    list(): Promise<readonly Bed[]>;
    create(input: CreateBedInput): Promise<UseCaseResult<Bed>>;
  };
  residents: {
    list(): Promise<readonly Resident[]>;
    create(input: CreateResidentInput): Promise<UseCaseResult<Resident>>;
  };
  placements: {
    list(): Promise<readonly Placement[]>;
    create(input: PlaceResidentInput): Promise<UseCaseResult<Placement>>;
  };
  residentTasks: {
    listForResident(residentId: string): Promise<readonly ResidentTask[]>;
    create(input: CreateResidentTaskInput): Promise<UseCaseResult<ResidentTask>>;
  };
  assignment: {
    generate(input: GenerateAssignmentDocumentInput): Promise<UseCaseResult<AssignmentDocumentModel>>;
  };
}

declare global {
  interface Window {
    tasksheet: TasksheetApi;
  }
}
