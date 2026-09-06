import type { UseCaseResult } from "../application/result.js";

/** Renders any non-success UseCaseResult as a single display string. */
export function describeUseCaseError(result: Exclude<UseCaseResult<unknown>, { kind: "success" }>): string {
  switch (result.kind) {
    case "validation":
    case "conflict":
    case "storage":
      return result.message;
    case "forbidden":
      return `Access denied: ${result.reason}`;
    case "unauthenticated":
      return "Your session has expired. Please sign in again.";
  }
}
