import type { AccessRole, Capability, LocalAccount } from "../../domain/accounts.js";
import { effectiveCapabilities } from "../../domain/accounts.js";

export type SessionState = "active" | "locked";

export interface Session {
  readonly sessionId: string;
  /** Opaque per-connection key the caller controls — Electron's `event.sender.id` in
   * production, a test-chosen string in tests. Never a renderer-supplied identity claim. */
  readonly senderKey: string;
  accountId: string;
  alias: string;
  role: AccessRole;
  grants: readonly Capability[];
  authRevision: number;
  state: SessionState;
  createdAtMs: number;
  lastActivityAtMs: number;
}

let sessionCounter = 0;

/**
 * In-memory, main-process-owned session store (ACCESS-CONTROL.md §5:
 * "Main process owns in-memory sessions; app restart requires sign-in").
 * One session per sender key — a second login from the same sender
 * replaces the first, matching this single-window desktop app.
 */
export class SessionManager {
  private readonly bySender = new Map<string, Session>();

  create(senderKey: string, account: Pick<LocalAccount, "id" | "alias" | "role" | "grants" | "authRevision">, nowMs: number): Session {
    const session: Session = {
      sessionId: `sess_${++sessionCounter}_${nowMs}`,
      senderKey,
      accountId: account.id,
      alias: account.alias,
      role: account.role,
      grants: account.grants,
      authRevision: account.authRevision,
      state: "active",
      createdAtMs: nowMs,
      lastActivityAtMs: nowMs
    };
    this.bySender.set(senderKey, session);
    return session;
  }

  getBySender(senderKey: string): Session | undefined {
    return this.bySender.get(senderKey);
  }

  touch(senderKey: string, nowMs: number): void {
    const session = this.bySender.get(senderKey);
    if (session && session.state === "active") session.lastActivityAtMs = nowMs;
  }

  lock(senderKey: string): void {
    const session = this.bySender.get(senderKey);
    if (session) session.state = "locked";
  }

  /** Locks every active session (OS session lock/suspend — ACCESS-CONTROL.md §5). */
  lockAll(): void {
    for (const session of this.bySender.values()) {
      if (session.state === "active") session.state = "locked";
    }
  }

  /** Unlock succeeds only for the same account that owns the locked session — callers must verify the password first. */
  unlock(senderKey: string, nowMs: number): Session | undefined {
    const session = this.bySender.get(senderKey);
    if (!session) return undefined;
    session.state = "active";
    session.lastActivityAtMs = nowMs;
    return session;
  }

  logout(senderKey: string): void {
    this.bySender.delete(senderKey);
  }

  /** Ends every session belonging to an account (password change, role/grant change, disable, recovery). */
  revokeAllForAccount(accountId: string): void {
    for (const [key, session] of this.bySender) {
      if (session.accountId === accountId) this.bySender.delete(key);
    }
  }

  hasCapability(session: Session, capability: Capability): boolean {
    return effectiveCapabilities(session.role, session.grants).has(capability);
  }

  /** Idle-lock sweep: pure over the current sessions, safe to unit test with a fake clock. */
  sweepIdleSessions(nowMs: number, timeoutMs: number): void {
    for (const session of this.bySender.values()) {
      if (session.state === "active" && nowMs - session.lastActivityAtMs >= timeoutMs) {
        session.state = "locked";
      }
    }
  }

  /** Test/diagnostic use only. */
  size(): number {
    return this.bySender.size;
  }
}
