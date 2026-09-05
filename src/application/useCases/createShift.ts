import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { Shift } from "../../domain/entities.js";
import { parseHHmm } from "../../domain/types.js";
import { newId } from "../ids.js";
import { conflictError, runGuarded, validationError, type UseCaseResult } from "../result.js";

export const CreateShiftInput = z.object({
  shortCode: z.string().min(1, "Short code is required").max(10),
  name: z.string().min(1, "Shift name is required"),
  role: z.enum(["HCA", "LPN"]),
  startTime: z.string().regex(/^([01]\d|2[0-3])[0-5]\d$/, "Start time must be HHmm, e.g. 0700"),
  endTime: z.string().regex(/^([01]\d|2[0-3])[0-5]\d$/, "End time must be HHmm, e.g. 1500"),
  displayOrder: z.number().int().default(0)
});
export type CreateShiftInput = z.input<typeof CreateShiftInput>;

export function createShift(repos: Repositories, rawInput: CreateShiftInput): UseCaseResult<Shift> {
  const parsed = CreateShiftInput.safeParse(rawInput);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const { shortCode, name, role, startTime, endTime, displayOrder } = parsed.data;

  if (repos.shifts.isShortCodeTaken(shortCode)) {
    return conflictError(`Short code "${shortCode}" is already used by an active shift.`);
  }

  const shift: Shift = {
    id: newId(),
    shortCode,
    name,
    role,
    startMinutes: parseHHmm(startTime),
    endMinutes: parseHHmm(endTime),
    active: true,
    displayOrder
  };

  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => {
      repos.shifts.create(shift);
    });
    return shift;
  });
}
