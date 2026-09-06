/**
 * The complete, allow-listed renderer <-> main IPC surface. This is the only
 * contract the renderer may rely on — no raw filesystem paths, no generic
 * query/key-value bridge (ARCHITECTURE-ESSENTIALS.md §3.1/§4). Every read
 * and mutation returns a typed UseCaseResult so the renderer can render
 * `unauthenticated`/`forbidden` in the centered attention-dialog flow
 * (ACCESS-CONTROL.md §4) rather than treating them as unexpected errors.
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
import type { DeactivateShiftInput } from "../application/useCases/deactivateShift.js";
import type {
  AdminResetPasswordInput,
  BootstrapFirstAdminInput,
  ChangeOwnPasswordInput,
  CreateAccountInput,
  LoginInput,
  PublicAccount,
  RecoverWithCodeInput,
  SessionStatus,
  SessionSummary,
  SetAccountEnabledInput,
  SetAccountRoleAndGrantsInput,
  UnlockInput
} from "../application/useCases/auth.js";
import type { SecurityEvent } from "../domain/accounts.js";

export const IPC_CHANNELS = {
  facilityGet: "facility:get",
  facilitySave: "facility:save",
  shiftList: "shift:list",
  shiftCreate: "shift:create",
  shiftDeactivate: "shift:deactivate",
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
  assignmentGenerate: "assignment:generate",

  authNeedsBootstrap: "auth:needsBootstrap",
  authBootstrapAdmin: "auth:bootstrapAdmin",
  authLogin: "auth:login",
  authLogout: "auth:logout",
  authLock: "auth:lock",
  authUnlock: "auth:unlock",
  authCurrentSession: "auth:currentSession",
  authSessionStatus: "auth:sessionStatus",
  authChangeOwnPassword: "auth:changeOwnPassword",
  authRecoverWithCode: "auth:recoverWithCode",
  authCreateAccount: "auth:createAccount",
  authSetAccountRoleAndGrants: "auth:setAccountRoleAndGrants",
  authSetAccountEnabled: "auth:setAccountEnabled",
  authAdminResetPassword: "auth:adminResetPassword",
  authListAccounts: "auth:listAccounts",
  authListSecurityEvents: "auth:listSecurityEvents"
} as const;

export interface TasksheetApi {
  facility: {
    get(): Promise<UseCaseResult<FacilitySettings | null>>;
    save(input: SaveFacilitySettingsInput): Promise<UseCaseResult<FacilitySettings>>;
  };
  shifts: {
    list(): Promise<UseCaseResult<readonly Shift[]>>;
    create(input: CreateShiftInput): Promise<UseCaseResult<Shift>>;
    deactivate(input: DeactivateShiftInput): Promise<UseCaseResult<{ shiftId: string }>>;
  };
  rooms: {
    list(): Promise<UseCaseResult<readonly Room[]>>;
    create(input: CreateRoomInput): Promise<UseCaseResult<Room>>;
  };
  beds: {
    list(): Promise<UseCaseResult<readonly Bed[]>>;
    create(input: CreateBedInput): Promise<UseCaseResult<Bed>>;
  };
  residents: {
    list(): Promise<UseCaseResult<readonly Resident[]>>;
    create(input: CreateResidentInput): Promise<UseCaseResult<Resident>>;
  };
  placements: {
    list(): Promise<UseCaseResult<readonly Placement[]>>;
    create(input: PlaceResidentInput): Promise<UseCaseResult<Placement>>;
  };
  residentTasks: {
    listForResident(residentId: string): Promise<UseCaseResult<readonly ResidentTask[]>>;
    create(input: CreateResidentTaskInput): Promise<UseCaseResult<ResidentTask>>;
  };
  assignment: {
    generate(input: GenerateAssignmentDocumentInput): Promise<UseCaseResult<AssignmentDocumentModel>>;
  };
  auth: {
    needsBootstrap(): Promise<boolean>;
    bootstrapAdmin(input: BootstrapFirstAdminInput): Promise<UseCaseResult<{ account: PublicAccount; recoveryCode: string }>>;
    login(input: LoginInput): Promise<UseCaseResult<SessionSummary>>;
    logout(): Promise<void>;
    lock(): Promise<void>;
    unlock(input: UnlockInput): Promise<UseCaseResult<SessionSummary>>;
    currentSession(): Promise<SessionSummary | null>;
    sessionStatus(): Promise<SessionStatus>;
    changeOwnPassword(input: ChangeOwnPasswordInput): Promise<UseCaseResult<SessionSummary>>;
    recoverWithCode(input: RecoverWithCodeInput): Promise<UseCaseResult<{ account: PublicAccount; recoveryCode: string }>>;
    createAccount(input: CreateAccountInput): Promise<UseCaseResult<PublicAccount>>;
    setAccountRoleAndGrants(input: SetAccountRoleAndGrantsInput): Promise<UseCaseResult<PublicAccount>>;
    setAccountEnabled(input: SetAccountEnabledInput): Promise<UseCaseResult<PublicAccount>>;
    adminResetPassword(input: AdminResetPasswordInput): Promise<UseCaseResult<PublicAccount>>;
    listAccounts(): Promise<UseCaseResult<readonly PublicAccount[]>>;
    listSecurityEvents(): Promise<UseCaseResult<readonly SecurityEvent[]>>;
  };
}

declare global {
  interface Window {
    tasksheet: TasksheetApi;
  }
}
