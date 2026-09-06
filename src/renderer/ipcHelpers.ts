import type { UseCaseResult } from "../application/result.js";
import { describeUseCaseError } from "./errorMessage.js";

/**
 * Unwraps a read-query UseCaseResult for a page's local state: on success
 * returns the value, on `unauthenticated` triggers a return to the sign-in
 * flow, otherwise reports the error string. Shared so every page handles
 * the auth-aware IPC contract (src/shared/ipc.ts) the same way.
 */
export function unwrapQuery<T>(
  result: UseCaseResult<T>,
  onUnauthenticated: () => void,
  onError: (message: string) => void
): T | undefined {
  if (result.kind === "success") return result.value;
  if (result.kind === "unauthenticated") {
    onUnauthenticated();
    return undefined;
  }
  onError(describeUseCaseError(result));
  return undefined;
}
