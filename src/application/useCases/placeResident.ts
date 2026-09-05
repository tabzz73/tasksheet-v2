import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { Placement } from "../../domain/entities.js";
import { isValidLocalDate } from "../../domain/types.js";
import { newId } from "../ids.js";
import { conflictError, runGuarded, validationError, type UseCaseResult } from "../result.js";

export const PlaceResidentInput = z.object({
  residentId: z.string().min(1, "Select a resident"),
  bedId: z.string().min(1, "Select a bed"),
  startDate: z.string().refine(isValidLocalDate, "Start date must be a valid calendar date")
});
export type PlaceResidentInput = z.input<typeof PlaceResidentInput>;

/**
 * Places a resident in a bed. Enforces the two occupancy invariants from
 * ARCHITECTURE-ESSENTIALS.md §3.2: one resident has at most one current
 * placement, one bed has at most one current resident.
 */
export function placeResident(repos: Repositories, rawInput: PlaceResidentInput): UseCaseResult<Placement> {
  const parsed = PlaceResidentInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));
  const { residentId, bedId, startDate } = parsed.data;

  if (!repos.residents.findById(residentId)) {
    return validationError(`Unknown resident: "${residentId}"`);
  }
  if (!repos.beds.findById(bedId)) {
    return validationError(`Unknown bed: "${bedId}"`);
  }
  if (repos.placements.currentForResident(residentId)) {
    return conflictError("This resident already has a current bed placement. End it before placing them elsewhere.");
  }
  if (repos.placements.currentForBed(bedId)) {
    return conflictError("This bed is already occupied by another current resident.");
  }

  const placement: Placement = { id: newId(), residentId, bedId, startDate: startDate as never, endDate: null };
  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => repos.placements.create(placement));
    return placement;
  });
}
