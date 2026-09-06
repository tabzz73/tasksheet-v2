import type Database from "better-sqlite3";
import type {
  Bed,
  FacilitySettings,
  Placement,
  Resident,
  ResidentStatus,
  ResidentTask,
  Room,
  Shift
} from "../../domain/entities.js";
import type { Schedule } from "../../domain/schedule.js";
import { toLocalTime, type Id, type LocalDate, type Provenance, type Role } from "../../domain/types.js";
import type {
  BedRepository,
  CatalogItemRepository,
  FacilityRepository,
  GenerationEventRepository,
  PlacementRepository,
  Repositories,
  ResidentRepository,
  ResidentTaskRepository,
  RoomRepository,
  ShiftRepository,
  UnitOfWork
} from "../../application/ports.js";
import { bumpDatasetRevision, currentDatasetRevision } from "./migrations.js";
import {
  SqliteAccountRepository,
  SqliteLoginLockoutRepository,
  SqliteRecoveryCodeRepository,
  SqliteSecurityEventRepository
} from "./accountRepositories.js";

function toBool(value: number): boolean {
  return value === 1;
}
function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

class SqliteFacilityRepository implements FacilityRepository {
  constructor(private readonly db: Database.Database) {}

  get(): FacilitySettings | null {
    const row = this.db.prepare("SELECT * FROM facility_settings LIMIT 1").get() as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      facilityId: row.facility_id as string,
      name: row.name as string,
      addressLine1: row.address_line1 as string,
      addressLine2: (row.address_line2 as string | null) ?? null,
      mainPhone: row.main_phone as string,
      nursingPhone: (row.nursing_phone as string | null) ?? null,
      fax: (row.fax as string | null) ?? null,
      timeZone: row.time_zone as string,
      weekStart: row.week_start as 1 | 7,
      escalationThreshold: row.escalation_threshold as number
    };
  }

  save(settings: FacilitySettings): void {
    this.db
      .prepare(
        `INSERT INTO facility_settings
          (facility_id, name, address_line1, address_line2, main_phone, nursing_phone, fax, time_zone, week_start, escalation_threshold)
         VALUES (@facilityId, @name, @addressLine1, @addressLine2, @mainPhone, @nursingPhone, @fax, @timeZone, @weekStart, @escalationThreshold)
         ON CONFLICT(facility_id) DO UPDATE SET
           name = excluded.name,
           address_line1 = excluded.address_line1,
           address_line2 = excluded.address_line2,
           main_phone = excluded.main_phone,
           nursing_phone = excluded.nursing_phone,
           fax = excluded.fax,
           time_zone = excluded.time_zone,
           week_start = excluded.week_start,
           escalation_threshold = excluded.escalation_threshold`
      )
      .run(settings);
  }
}

class SqliteRoomRepository implements RoomRepository {
  constructor(private readonly db: Database.Database) {}

  listActive(): readonly Room[] {
    const rows = this.db.prepare("SELECT * FROM rooms WHERE active = 1 ORDER BY sort_key").all() as Record<
      string,
      unknown
    >[];
    return rows.map((row) => ({
      id: row.id as string,
      label: row.label as string,
      sortKey: row.sort_key as string,
      active: toBool(row.active as number)
    }));
  }

  findById(id: Id): Room | null {
    const row = this.db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: row.id as string, label: row.label as string, sortKey: row.sort_key as string, active: toBool(row.active as number) };
  }

  create(room: Room): void {
    this.db
      .prepare("INSERT INTO rooms (id, label, sort_key, active) VALUES (?, ?, ?, ?)")
      .run(room.id, room.label, room.sortKey, fromBool(room.active));
  }
}

class SqliteBedRepository implements BedRepository {
  constructor(private readonly db: Database.Database) {}

  private map(row: Record<string, unknown>): Bed {
    return { id: row.id as string, roomId: row.room_id as string, label: row.label as string, active: toBool(row.active as number) };
  }

  listByRoom(roomId: Id): readonly Bed[] {
    return (this.db.prepare("SELECT * FROM beds WHERE room_id = ? ORDER BY label").all(roomId) as Record<string, unknown>[]).map(
      (r) => this.map(r)
    );
  }

  listActive(): readonly Bed[] {
    return (this.db.prepare("SELECT * FROM beds WHERE active = 1").all() as Record<string, unknown>[]).map((r) => this.map(r));
  }

  findById(id: Id): Bed | null {
    const row = this.db.prepare("SELECT * FROM beds WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  create(bed: Bed): void {
    this.db
      .prepare("INSERT INTO beds (id, room_id, label, active) VALUES (?, ?, ?, ?)")
      .run(bed.id, bed.roomId, bed.label, fromBool(bed.active));
  }
}

class SqliteResidentRepository implements ResidentRepository {
  constructor(private readonly db: Database.Database) {}

  private map(row: Record<string, unknown>): Resident {
    return {
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      status: row.status as ResidentStatus,
      source: row.source as Provenance,
      sourceBatchId: (row.source_batch_id as string | null) ?? null
    };
  }

  listActive(): readonly Resident[] {
    return (
      this.db.prepare("SELECT * FROM residents ORDER BY last_name, first_name").all() as Record<string, unknown>[]
    ).map((r) => this.map(r));
  }

  findById(id: Id): Resident | null {
    const row = this.db.prepare("SELECT * FROM residents WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  create(resident: Resident): void {
    this.db
      .prepare(
        "INSERT INTO residents (id, first_name, last_name, status, source, source_batch_id) VALUES (@id, @firstName, @lastName, @status, @source, @sourceBatchId)"
      )
      .run(resident);
  }
}

class SqlitePlacementRepository implements PlacementRepository {
  constructor(private readonly db: Database.Database) {}

  private map(row: Record<string, unknown>): Placement {
    return {
      id: row.id as string,
      residentId: row.resident_id as string,
      bedId: row.bed_id as string,
      startDate: row.start_date as LocalDate,
      endDate: (row.end_date as LocalDate | null) ?? null
    };
  }

  listCurrent(): readonly Placement[] {
    return (this.db.prepare("SELECT * FROM placements WHERE end_date IS NULL").all() as Record<string, unknown>[]).map(
      (r) => this.map(r)
    );
  }

  currentForResident(residentId: Id): Placement | null {
    const row = this.db
      .prepare("SELECT * FROM placements WHERE resident_id = ? AND end_date IS NULL")
      .get(residentId) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  currentForBed(bedId: Id): Placement | null {
    const row = this.db.prepare("SELECT * FROM placements WHERE bed_id = ? AND end_date IS NULL").get(bedId) as
      | Record<string, unknown>
      | undefined;
    return row ? this.map(row) : null;
  }

  create(placement: Placement): void {
    this.db
      .prepare(
        "INSERT INTO placements (id, resident_id, bed_id, start_date, end_date) VALUES (@id, @residentId, @bedId, @startDate, @endDate)"
      )
      .run(placement);
  }
}

class SqliteShiftRepository implements ShiftRepository {
  constructor(private readonly db: Database.Database) {}

  private map(row: Record<string, unknown>): Shift {
    return {
      id: row.id as string,
      shortCode: row.short_code as string,
      name: row.name as string,
      role: row.role as Role,
      startMinutes: toLocalTime(row.start_minutes as number),
      endMinutes: toLocalTime(row.end_minutes as number),
      active: toBool(row.active as number),
      displayOrder: row.display_order as number
    };
  }

  listActive(): readonly Shift[] {
    return (
      this.db.prepare("SELECT * FROM shifts WHERE active = 1 ORDER BY display_order, name").all() as Record<
        string,
        unknown
      >[]
    ).map((r) => this.map(r));
  }

  findById(id: Id): Shift | null {
    const row = this.db.prepare("SELECT * FROM shifts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  create(shift: Shift): void {
    this.db
      .prepare(
        `INSERT INTO shifts (id, short_code, name, role, start_minutes, end_minutes, active, display_order)
         VALUES (@id, @shortCode, @name, @role, @startMinutes, @endMinutes, @active, @displayOrder)`
      )
      .run({ ...shift, active: fromBool(shift.active) });
  }

  isShortCodeTaken(shortCode: string, excludeId?: Id): boolean {
    const row = this.db
      .prepare("SELECT id FROM shifts WHERE short_code = ? AND active = 1 AND id != ?")
      .get(shortCode, excludeId ?? "") as { id: string } | undefined;
    return row !== undefined;
  }

  deactivate(id: Id): void {
    this.db.prepare("UPDATE shifts SET active = 0 WHERE id = ?").run(id);
  }
}

class SqliteCatalogItemRepository implements CatalogItemRepository {
  constructor(private readonly db: Database.Database) {}

  create(item: { catalogItemId: string; version: number; name: string; category: string; instructions: string; active: boolean }): void {
    this.db
      .prepare("INSERT INTO catalog_items (id, version, name, category, instructions, active) VALUES (?, ?, ?, ?, ?, ?)")
      .run(item.catalogItemId, item.version, item.name, item.category, item.instructions, fromBool(item.active));
  }

  findById(id: Id) {
    const row = this.db.prepare("SELECT * FROM catalog_items WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      catalogItemId: row.id as string,
      version: row.version as number,
      name: row.name as string,
      category: row.category as string,
      instructions: row.instructions as string,
      active: toBool(row.active as number)
    };
  }
}

class SqliteResidentTaskRepository implements ResidentTaskRepository {
  constructor(private readonly db: Database.Database) {}

  private map(row: Record<string, unknown>): ResidentTask {
    return {
      id: row.id as string,
      residentId: row.resident_id as string,
      role: row.role as Role,
      eligibleShiftIds: JSON.parse(row.eligible_shift_ids as string) as string[],
      schedule: JSON.parse(row.schedule_json as string) as Schedule,
      scheduleRevision: row.schedule_revision as number,
      activeFrom: row.active_from as LocalDate,
      activeTo: (row.active_to as LocalDate | null) ?? null,
      active: toBool(row.active as number),
      catalog: {
        catalogItemId: row.catalog_item_id as string,
        version: row.catalog_version as number,
        name: row.catalog_name as string,
        category: row.catalog_category as string,
        instructions: row.catalog_instructions as string
      },
      importantInformation: (row.important_information as string | null) ?? null,
      showOnPrint: toBool(row.show_on_print as number),
      source: row.source as Provenance,
      sourceBatchId: (row.source_batch_id as string | null) ?? null
    };
  }

  listActive(): readonly ResidentTask[] {
    return (this.db.prepare("SELECT * FROM resident_tasks WHERE active = 1").all() as Record<string, unknown>[]).map(
      (r) => this.map(r)
    );
  }

  listForResident(residentId: Id): readonly ResidentTask[] {
    return (
      this.db.prepare("SELECT * FROM resident_tasks WHERE resident_id = ?").all(residentId) as Record<
        string,
        unknown
      >[]
    ).map((r) => this.map(r));
  }

  create(task: ResidentTask): void {
    this.db
      .prepare(
        `INSERT INTO resident_tasks
          (id, resident_id, role, eligible_shift_ids, schedule_json, schedule_revision, active_from, active_to, active,
           catalog_item_id, catalog_version, catalog_name, catalog_category, catalog_instructions,
           important_information, show_on_print, source, source_batch_id)
         VALUES
          (@id, @residentId, @role, @eligibleShiftIds, @scheduleJson, @scheduleRevision, @activeFrom, @activeTo, @active,
           @catalogItemId, @catalogVersion, @catalogName, @catalogCategory, @catalogInstructions,
           @importantInformation, @showOnPrint, @source, @sourceBatchId)`
      )
      .run({
        id: task.id,
        residentId: task.residentId,
        role: task.role,
        eligibleShiftIds: JSON.stringify(task.eligibleShiftIds),
        scheduleJson: JSON.stringify(task.schedule),
        scheduleRevision: task.scheduleRevision,
        activeFrom: task.activeFrom,
        activeTo: task.activeTo,
        active: fromBool(task.active),
        catalogItemId: task.catalog.catalogItemId,
        catalogVersion: task.catalog.version,
        catalogName: task.catalog.name,
        catalogCategory: task.catalog.category,
        catalogInstructions: task.catalog.instructions,
        importantInformation: task.importantInformation,
        showOnPrint: fromBool(task.showOnPrint),
        source: task.source,
        sourceBatchId: task.sourceBatchId
      });
  }
}

class SqliteGenerationEventRepository implements GenerationEventRepository {
  constructor(private readonly db: Database.Database) {}

  record(event: {
    id: Id;
    documentKind: string;
    assignmentDate: string;
    shiftId: Id;
    generatedAt: string;
    sourceDatasetRevision: number;
  }): void {
    this.db
      .prepare(
        `INSERT INTO generation_events (id, document_kind, assignment_date, shift_id, generated_at, source_dataset_revision)
         VALUES (@id, @documentKind, @assignmentDate, @shiftId, @generatedAt, @sourceDatasetRevision)`
      )
      .run(event);
  }
}

class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database.Database) {}

  currentDatasetRevision(): number {
    return currentDatasetRevision(this.db);
  }

  runMutation<T>(fn: () => T): { result: T; revision: number } {
    const tx = this.db.transaction(() => {
      const result = fn();
      const revision = bumpDatasetRevision(this.db);
      return { result, revision };
    });
    return tx();
  }
}

export function createSqliteRepositories(db: Database.Database): Repositories {
  return {
    facility: new SqliteFacilityRepository(db),
    rooms: new SqliteRoomRepository(db),
    beds: new SqliteBedRepository(db),
    residents: new SqliteResidentRepository(db),
    placements: new SqlitePlacementRepository(db),
    shifts: new SqliteShiftRepository(db),
    catalogItems: new SqliteCatalogItemRepository(db),
    residentTasks: new SqliteResidentTaskRepository(db),
    generationEvents: new SqliteGenerationEventRepository(db),
    accounts: new SqliteAccountRepository(db),
    loginLockouts: new SqliteLoginLockoutRepository(db),
    securityEvents: new SqliteSecurityEventRepository(db),
    recoveryCode: new SqliteRecoveryCodeRepository(db),
    unitOfWork: new SqliteUnitOfWork(db)
  };
}
