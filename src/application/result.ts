/**
 * Common use-case result shape (DATA-CONTRACTS.md §6): every mutation
 * returns a typed validation/conflict/storage/success result rather than
 * throwing across the IPC boundary.
 */
export type UseCaseResult<T> =
  | { kind: "success"; value: T }
  | { kind: "validation"; message: string; fieldErrors?: Record<string, string> }
  | { kind: "conflict"; message: string }
  | { kind: "storage"; message: string };

export function success<T>(value: T): UseCaseResult<T> {
  return { kind: "success", value };
}

export function validationError<T>(message: string, fieldErrors?: Record<string, string>): UseCaseResult<T> {
  return { kind: "validation", message, fieldErrors };
}

export function conflictError<T>(message: string): UseCaseResult<T> {
  return { kind: "conflict", message };
}

export function storageError<T>(message: string): UseCaseResult<T> {
  return { kind: "storage", message };
}

/** Runs a use-case body, turning any thrown persistence/domain error into a typed result. */
export function runGuarded<T>(fn: () => T): UseCaseResult<T> {
  try {
    return success(fn());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      return conflictError(message);
    }
    return storageError(message);
  }
}
