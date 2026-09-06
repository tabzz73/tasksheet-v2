import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { FacilitySettings } from "../../domain/entities.js";
import { runGuarded, validationError, type UseCaseResult } from "../result.js";

export const SaveFacilitySettingsInput = z.object({
  facilityId: z.string().min(1),
  name: z.string().min(1, "Facility name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().nullable().default(null),
  mainPhone: z.string().min(1, "Main phone is required"),
  nursingPhone: z.string().nullable().default(null),
  fax: z.string().nullable().default(null),
  timeZone: z.string().min(1, "Timezone is required"),
  weekStart: z.union([z.literal(1), z.literal(7)]),
  escalationThreshold: z.number().int().positive().default(3),
  // Bounds fixed by ACCESS-CONTROL.md §5: "configurable by Administrator from 5-60 minutes."
  inactivityLockMinutes: z.number().int().min(5, "Inactivity lock must be at least 5 minutes").max(60, "Inactivity lock must be at most 60 minutes").default(10)
});
export type SaveFacilitySettingsInput = z.input<typeof SaveFacilitySettingsInput>;

export function saveFacilitySettings(repos: Repositories, rawInput: SaveFacilitySettingsInput): UseCaseResult<FacilitySettings> {
  const parsed = SaveFacilitySettingsInput.safeParse(rawInput);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  // Confirm the IANA timezone is resolvable rather than trusting free text.
  try {
    Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timeZone });
  } catch {
    return validationError(`Unrecognized timezone: "${parsed.data.timeZone}"`);
  }

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      repos.facility.save(parsed.data);
      return parsed.data;
    });
    return result;
  });
}
