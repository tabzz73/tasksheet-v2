import { randomUUID } from "node:crypto";
import type { Id } from "../domain/types.js";

export function newId(): Id {
  return randomUUID();
}
