import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { Resident } from "../../domain/entities.js";
import { newId } from "../ids.js";
import { runGuarded, validationError, type UseCaseResult } from "../result.js";

export const CreateResidentInput = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required")
});
export type CreateResidentInput = z.input<typeof CreateResidentInput>;

export function createResident(repos: Repositories, rawInput: CreateResidentInput): UseCaseResult<Resident> {
  const parsed = CreateResidentInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const resident: Resident = {
    id: newId(),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    status: "active",
    source: "manual",
    sourceBatchId: null
  };

  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => repos.residents.create(resident));
    return resident;
  });
}
