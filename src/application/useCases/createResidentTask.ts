import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { CatalogSnapshot, ResidentTask } from "../../domain/entities.js";
import { validateCadence, validatePlacement, type Cadence, type Placement } from "../../domain/schedule.js";
import { isValidLocalDate, parseHHmm } from "../../domain/types.js";
import { newId } from "../ids.js";
import { runGuarded, validationError, type UseCaseResult } from "../result.js";

const CadenceInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int().min(1).max(7)).min(1) }),
  z.object({ kind: z.literal("interval"), everyDays: z.number().int().positive(), anchorDate: z.string().refine(isValidLocalDate) }),
  z.object({ kind: z.literal("month_days"), days: z.array(z.number().int().min(1).max(31)).min(1) }),
  z.object({ kind: z.literal("one_time"), date: z.string().refine(isValidLocalDate) })
]);

const PlacementInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("times"), times: z.array(z.string().regex(/^([01]\d|2[0-3])[0-5]\d$/)).min(1) }),
  z.object({ kind: z.literal("period"), period: z.enum(["DAY", "EVENING", "NIGHT"]) }),
  z.object({ kind: z.literal("date_only") })
]);

export const CreateResidentTaskInput = z.object({
  residentId: z.string().min(1, "Select a resident"),
  role: z.enum(["HCA", "LPN"]),
  eligibleShiftIds: z.array(z.string().min(1)).min(1, "Select at least one eligible shift"),
  taskName: z.string().min(1, "Task name is required"),
  category: z.string().min(1).default("clinical"),
  instructions: z.string().default(""),
  importantInformation: z.string().nullable().default(null),
  cadence: CadenceInput,
  placement: PlacementInput,
  activeFrom: z.string().refine(isValidLocalDate, "Active-from must be a valid calendar date")
});
export type CreateResidentTaskInput = z.input<typeof CreateResidentTaskInput>;

export function createResidentTask(repos: Repositories, rawInput: CreateResidentTaskInput): UseCaseResult<ResidentTask> {
  const parsed = CreateResidentTaskInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  if (!repos.residents.findById(data.residentId)) {
    return validationError(`Unknown resident: "${data.residentId}"`);
  }
  for (const shiftId of data.eligibleShiftIds) {
    const shift = repos.shifts.findById(shiftId);
    if (!shift) return validationError(`Unknown shift: "${shiftId}"`);
    if (shift.role !== data.role) {
      return validationError(`Shift "${shift.name}" does not match role ${data.role}.`);
    }
  }

  const cadence: Cadence =
    data.cadence.kind === "weekdays"
      ? { kind: "weekdays", days: data.cadence.days as (1 | 2 | 3 | 4 | 5 | 6 | 7)[] }
      : (data.cadence as Cadence);
  const placement: Placement =
    data.placement.kind === "times"
      ? { kind: "times", minutes: data.placement.times.map((t) => parseHHmm(t)) }
      : (data.placement as Placement);

  try {
    validateCadence(cadence);
    validatePlacement(placement);
  } catch (error) {
    return validationError(error instanceof Error ? error.message : String(error));
  }

  const catalog: CatalogSnapshot = {
    catalogItemId: newId(),
    version: 1,
    name: data.taskName,
    category: data.category,
    instructions: data.instructions
  };

  const task: ResidentTask = {
    id: newId(),
    residentId: data.residentId,
    role: data.role,
    eligibleShiftIds: data.eligibleShiftIds,
    schedule: { cadence, placement },
    scheduleRevision: 1,
    activeFrom: data.activeFrom as never,
    activeTo: null,
    active: true,
    catalog,
    importantInformation: data.importantInformation,
    showOnPrint: true,
    source: "manual",
    sourceBatchId: null
  };

  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => {
      repos.catalogItems.create({ ...catalog, active: true });
      repos.residentTasks.create(task);
    });
    return task;
  });
}
