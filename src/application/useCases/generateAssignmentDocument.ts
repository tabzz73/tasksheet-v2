import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { Clock } from "../clock.js";
import { generateAssignmentDocument as buildDocument, type AssignmentDocumentModel } from "../../domain/generation.js";
import { isValidLocalDate, type LocalDate } from "../../domain/types.js";
import { newId } from "../ids.js";
import { validationError, type UseCaseResult } from "../result.js";

export const GenerateAssignmentDocumentInput = z.object({
  date: z.string().refine(isValidLocalDate, "Date must be a valid calendar date"),
  shiftId: z.string().min(1, "Select a shift")
});
export type GenerateAssignmentDocumentInput = z.input<typeof GenerateAssignmentDocumentInput>;

/**
 * Assembles the generation pipeline's read-model inputs from repositories
 * and delegates to the pure domain generator (ARCHITECTURE-ESSENTIALS.md
 * §7). Records a generation event; never mutates clinical/task data.
 */
export function generateAssignmentDocument(
  repos: Repositories,
  clock: Clock,
  rawInput: GenerateAssignmentDocumentInput
): UseCaseResult<AssignmentDocumentModel> {
  const parsed = GenerateAssignmentDocumentInput.safeParse(rawInput);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const facility = repos.facility.get();
  if (!facility) {
    return validationError("Complete facility setup before generating an assignment sheet.");
  }
  const shift = repos.shifts.findById(parsed.data.shiftId);
  if (!shift) {
    return validationError("The selected shift no longer exists or is inactive.");
  }

  const date = parsed.data.date as LocalDate;
  const document = buildDocument({
    facility,
    shift,
    date,
    residents: repos.residents.listActive(),
    placements: repos.placements.listCurrent(),
    beds: repos.beds.listActive(),
    rooms: repos.rooms.listActive(),
    tasks: repos.residentTasks.listActive(),
    generatedAt: clock.nowInstant(),
    sourceDatasetRevision: repos.unitOfWork.currentDatasetRevision()
  });

  repos.generationEvents.record({
    id: newId(),
    documentKind: document.kind,
    assignmentDate: date,
    shiftId: shift.id,
    generatedAt: document.requestedContext.generatedAt,
    sourceDatasetRevision: document.requestedContext.sourceDatasetRevision
  });

  return { kind: "success", value: document };
}
