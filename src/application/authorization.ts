/**
 * Default-deny main-process authorization (ACCESS-CONTROL.md §4). Every
 * capability-gated use case is invoked through `authorize()` first — see
 * authorizedUseCases.ts for the composition every IPC handler actually
 * calls. This module never trusts a renderer-supplied actor/role: the
 * only input is the sender-bound `senderKey` already established by a
 * successful login (sessionManager.ts).
 */
import type { Capability } from "../domain/accounts.js";
import type { AccountRepository, SecurityEventRepository } from "./ports.js";
import type { Session } from "./auth/sessionManager.js";
import { SessionManager } from "./auth/sessionManager.js";
import type { Clock } from "./clock.js";

export type AuthzResult =
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; reason: string }
  | { kind: "authorized"; session: Session };

export interface AuthzDeps {
  sessions: SessionManager;
  accounts: AccountRepository;
  securityEvents: SecurityEventRepository;
  clock: Clock;
}

/**
 * Re-validates the session's account on every call — enabled state and
 * auth revision — rather than trusting the cached session fields
 * (ACCESS-CONTROL.md §4: "Recheck account enabled state, auth revision and
 * permissions immediately before committing"). A stale session (disabled,
 * revoked-by-role-change, or deleted account) is logged out here so the
 * next call is a clean `unauthenticated`, not a silent repeat denial.
 */
export function authorize(deps: AuthzDeps, senderKey: string, capability: Capability): AuthzResult {
  const session = deps.sessions.getBySender(senderKey);
  if (!session || session.state !== "active") {
    return { kind: "unauthenticated" };
  }

  const account = deps.accounts.findById(session.accountId);
  if (!account || !account.enabled || account.authRevision !== session.authRevision) {
    deps.sessions.logout(senderKey);
    return { kind: "unauthenticated" };
  }

  if (account.mustChangePassword) {
    return { kind: "forbidden", reason: "Password change required before continuing." };
  }

  if (!deps.sessions.hasCapability(session, capability)) {
    deps.securityEvents.record({
      kind: "forbidden_attempt",
      actorAccountId: account.id,
      targetAccountId: null,
      reason: capability,
      occurredAt: deps.clock.nowInstant()
    });
    return { kind: "forbidden", reason: `Not permitted: ${capability}` };
  }

  deps.sessions.touch(senderKey, Date.now());
  return { kind: "authorized", session };
}

/** True when `capability` is view/print-class and therefore open to any authenticated role including Viewer. */
export function isViewerAllowed(capability: Capability): boolean {
  return capability === "assignment.generate";
}

/**
 * authorize() variant for read/print operations that ACCESS-CONTROL.md §2
 * grants to every authenticated role (Administrator/Editor/Viewer) rather
 * than gating by the mutation capability table — e.g. "Preview and print
 * authorized operational documents: Yes/Yes/Yes". Still requires an
 * active, non-stale, non-must-change-password session.
 */
export function authorizeAuthenticated(deps: AuthzDeps, senderKey: string): AuthzResult {
  const session = deps.sessions.getBySender(senderKey);
  if (!session || session.state !== "active") {
    return { kind: "unauthenticated" };
  }
  const account = deps.accounts.findById(session.accountId);
  if (!account || !account.enabled || account.authRevision !== session.authRevision) {
    deps.sessions.logout(senderKey);
    return { kind: "unauthenticated" };
  }
  if (account.mustChangePassword) {
    return { kind: "forbidden", reason: "Password change required before continuing." };
  }
  deps.sessions.touch(senderKey, Date.now());
  return { kind: "authorized", session };
}

export function recordSecurityEvent(
  deps: Pick<AuthzDeps, "securityEvents" | "clock">,
  kind: Parameters<SecurityEventRepository["record"]>[0]["kind"],
  actorAccountId: string | null,
  targetAccountId: string | null,
  reason: string | null
): void {
  deps.securityEvents.record({ kind, actorAccountId, targetAccountId, reason, occurredAt: deps.clock.nowInstant() });
}
