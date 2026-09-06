/**
 * Repository interfaces. Application use cases depend only on these, never
 * on better-sqlite3 or a concrete adapter (ARCHITECTURE-ESSENTIALS.md §4).
 */
import type {
  Bed,
  CatalogSnapshot,
  FacilitySettings,
  Placement,
  Resident,
  ResidentTask,
  Room,
  Shift
} from "../domain/entities.js";
import type { Id } from "../domain/types.js";
import type { AccessRole, Capability, LocalAccount, LoginLockoutState, SecurityEvent, SecurityEventKind } from "../domain/accounts.js";

export interface FacilityRepository {
  get(): FacilitySettings | null;
  save(settings: FacilitySettings): void;
}

export interface RoomRepository {
  listActive(): readonly Room[];
  create(room: Room): void;
  findById(id: Id): Room | null;
}

export interface BedRepository {
  listByRoom(roomId: Id): readonly Bed[];
  listActive(): readonly Bed[];
  create(bed: Bed): void;
  findById(id: Id): Bed | null;
}

export interface ResidentRepository {
  listActive(): readonly Resident[];
  create(resident: Resident): void;
  findById(id: Id): Resident | null;
}

export interface PlacementRepository {
  listCurrent(): readonly Placement[];
  currentForResident(residentId: Id): Placement | null;
  currentForBed(bedId: Id): Placement | null;
  create(placement: Placement): void;
}

export interface ShiftRepository {
  listActive(): readonly Shift[];
  findById(id: Id): Shift | null;
  create(shift: Shift): void;
  isShortCodeTaken(shortCode: string, excludeId?: Id): boolean;
  deactivate(id: Id): void;
}

export interface CatalogItemRepository {
  create(item: CatalogSnapshot & { active: boolean }): void;
  findById(id: Id): (CatalogSnapshot & { active: boolean }) | null;
}

export interface ResidentTaskRepository {
  listActive(): readonly ResidentTask[];
  listForResident(residentId: Id): readonly ResidentTask[];
  create(task: ResidentTask): void;
}

export interface GenerationEventRepository {
  record(event: {
    id: Id;
    documentKind: string;
    assignmentDate: string;
    shiftId: Id;
    generatedAt: string;
    sourceDatasetRevision: number;
  }): void;
}

export interface AccountRepository {
  countEnabledAdministrators(): number;
  countAll(): number;
  findById(id: Id): LocalAccount | null;
  findByAlias(alias: string): LocalAccount | null;
  listAll(): readonly LocalAccount[];
  create(account: LocalAccount & { passwordVerifier: string }): void;
  updatePasswordVerifier(id: Id, passwordVerifier: string, newAuthRevision: number, mustChangePassword: boolean): void;
  getPasswordVerifier(id: Id): string | null;
  updateRoleAndGrants(id: Id, role: AccessRole, grants: readonly Capability[], newAuthRevision: number): void;
  setEnabled(id: Id, enabled: boolean, newAuthRevision: number): void;
}

export interface LoginLockoutRepository {
  get(accountId: Id): LoginLockoutState | null;
  recordFailure(accountId: Id, nowIso: string, windowMs: number): LoginLockoutState;
  clear(accountId: Id): void;
}

export interface SecurityEventRepository {
  record(event: { kind: SecurityEventKind; actorAccountId: Id | null; targetAccountId: Id | null; reason: string | null; occurredAt: string }): void;
  listRecent(limit: number): readonly SecurityEvent[];
}

export interface RecoveryCodeRepository {
  setVerifier(verifier: string | null): void;
  getVerifier(): string | null;
}

export interface UnitOfWork {
  currentDatasetRevision(): number;
  /** Runs `fn` in a single transaction and returns the new dataset revision. */
  runMutation<T>(fn: () => T): { result: T; revision: number };
}

export interface Repositories {
  facility: FacilityRepository;
  rooms: RoomRepository;
  beds: BedRepository;
  residents: ResidentRepository;
  placements: PlacementRepository;
  shifts: ShiftRepository;
  catalogItems: CatalogItemRepository;
  residentTasks: ResidentTaskRepository;
  generationEvents: GenerationEventRepository;
  accounts: AccountRepository;
  loginLockouts: LoginLockoutRepository;
  securityEvents: SecurityEventRepository;
  recoveryCode: RecoveryCodeRepository;
  unitOfWork: UnitOfWork;
}
