import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { Bed, Room } from "../../domain/entities.js";
import { naturalRoomSortKey } from "../../domain/generation.js";
import { newId } from "../ids.js";
import { conflictError, runGuarded, validationError, type UseCaseResult } from "../result.js";

export const CreateRoomInput = z.object({ label: z.string().min(1, "Room label is required") });
export type CreateRoomInput = z.input<typeof CreateRoomInput>;

export function createRoom(repos: Repositories, rawInput: CreateRoomInput): UseCaseResult<Room> {
  const parsed = CreateRoomInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const room: Room = { id: newId(), label: parsed.data.label, sortKey: naturalRoomSortKey(parsed.data.label), active: true };
  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => repos.rooms.create(room));
    return room;
  });
}

export const CreateBedInput = z.object({ roomId: z.string().min(1), label: z.string().min(1, "Bed label is required") });
export type CreateBedInput = z.input<typeof CreateBedInput>;

export function createBed(repos: Repositories, rawInput: CreateBedInput): UseCaseResult<Bed> {
  const parsed = CreateBedInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  if (!repos.rooms.findById(parsed.data.roomId)) {
    return validationError(`Unknown room: "${parsed.data.roomId}"`);
  }
  const existing = repos.beds.listByRoom(parsed.data.roomId).some((b) => b.label === parsed.data.label);
  if (existing) {
    return conflictError(`Bed "${parsed.data.label}" already exists in this room.`);
  }

  const bed: Bed = { id: newId(), roomId: parsed.data.roomId, label: parsed.data.label, active: true };
  return runGuarded(() => {
    repos.unitOfWork.runMutation(() => repos.beds.create(bed));
    return bed;
  });
}
