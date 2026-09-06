import { z } from "zod";
import type { Repositories } from "../ports.js";
import { runGuarded, validationError, type UseCaseResult } from "../result.js";

export const DeactivateShiftInput = z.object({ shiftId: z.string().min(1) });
export type DeactivateShiftInput = z.input<typeof DeactivateShiftInput>;

/**
 * A minimal deletion-class lifecycle action (ACCESS-CONTROL.md §2/§3):
 * distinct from `shift.create`/edit, gated by the separate `shift.deactivate`
 * capability that an Administrator must explicitly grant to an Editor.
 */
export function deactivateShift(repos: Repositories, rawInput: DeactivateShiftInput): UseCaseResult<{ shiftId: string }> {
  const parsed = DeactivateShiftInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const shift = repos.shifts.findById(parsed.data.shiftId);
  if (!shift) return validationError("Unknown shift.");

  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => {
      repos.shifts.deactivate(parsed.data.shiftId);
    });
    return { shiftId: parsed.data.shiftId };
  });
}
