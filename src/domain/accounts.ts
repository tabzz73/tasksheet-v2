/**
 * Local account, role and capability model per ACCESS-CONTROL.md. This is
 * an application-access boundary, independent of HCA/LPN/RN care-output
 * roles, and persists no employee profile data (ACCESS-CONTROL.md §1).
 */
import type { Id, Instant } from "./types.js";

export type AccessRole = "Administrator" | "Editor" | "Viewer";

/**
 * Allow-listed capabilities. Every mutating/export/administrative use case
 * maps to exactly one of these (ACCESS-CONTROL.md §4): "map every command
 * to a capability... unknown commands/capabilities fail closed."
 */
export const CAPABILITIES = [
  "facility.update",
  "shift.create",
  "shift.deactivate",
  "room.create",
  "bed.create",
  "resident.create",
  "resident.place",
  "residentTask.create",
  "assignment.generate",
  "accounts.manage",
  "security.audit.read"
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * Grantable capabilities an Administrator may extend to an individual
 * Editor account beyond the role default (ACCESS-CONTROL.md §2's "Grant"
 * column). Per that table's "Create/edit/deactivate rooms, beds, shifts
 * and assignment configuration" row (Administrator Yes / Editor "Grant per
 * resource/action" / Viewer No), room/bed/shift creation is grant-gated
 * for Editors, not a default — unlike resident/task creation, which falls
 * under the "Create/edit residents, placement, care/unit tasks..." row
 * (Editor: Yes by default).
 */
export const GRANTABLE_EDITOR_CAPABILITIES: readonly Capability[] = ["shift.create", "shift.deactivate", "room.create", "bed.create"];

/**
 * Default role -> capability table (ACCESS-CONTROL.md §2), before any
 * per-account Editor grant is applied. Administrator has every capability;
 * Viewer has none (business data view/print is handled outside the
 * capability gate — see ACCESS-CONTROL.md's "View... print" row, which is
 * available to all authenticated roles rather than capability-gated).
 */
const EDITOR_DEFAULT_CAPABILITIES: ReadonlySet<Capability> = new Set([
  "resident.create",
  "resident.place",
  "residentTask.create",
  "assignment.generate"
]);

export function defaultCapabilitiesForRole(role: AccessRole): ReadonlySet<Capability> {
  if (role === "Administrator") return new Set(CAPABILITIES);
  if (role === "Editor") return new Set(EDITOR_DEFAULT_CAPABILITIES);
  return new Set();
}

export function effectiveCapabilities(role: AccessRole, grants: readonly Capability[]): ReadonlySet<Capability> {
  const base = new Set(defaultCapabilitiesForRole(role));
  if (role === "Editor") {
    for (const grant of grants) {
      if (GRANTABLE_EDITOR_CAPABILITIES.includes(grant)) base.add(grant);
    }
  }
  return base;
}

export interface LocalAccount {
  id: Id;
  alias: string;
  role: AccessRole;
  /** Extra capabilities granted to an Editor beyond the role default. Ignored for Administrator/Viewer. */
  grants: readonly Capability[];
  enabled: boolean;
  /** True after an Administrator reset; the account must change its password before any other access. */
  mustChangePassword: boolean;
  /** Bumped on password change, role/grant change, disable/enable — invalidates outstanding sessions/results. */
  authRevision: number;
  createdAt: Instant;
  updatedAt: Instant;
}

/** Bounded escalating-delay failed-login state (ACCESS-CONTROL.md §5), kept per account. */
export interface LoginLockoutState {
  accountId: Id;
  failedAttempts: number;
  windowStartedAt: Instant | null;
  cooldownUntil: Instant | null;
}

export type SecurityEventKind =
  | "bootstrap_admin_created"
  | "login_success"
  | "login_failure"
  | "logout"
  | "lock"
  | "unlock"
  | "password_changed"
  | "password_reset_by_admin"
  | "recovery_used"
  | "account_created"
  | "account_role_changed"
  | "account_grants_changed"
  | "account_disabled"
  | "account_enabled"
  | "forbidden_attempt"
  | "session_revoked";

export interface SecurityEvent {
  id: Id;
  kind: SecurityEventKind;
  actorAccountId: Id | null;
  targetAccountId: Id | null;
  reason: string | null;
  occurredAt: Instant;
}
