import { describe, expect, it } from "vitest";
import { SessionManager } from "../../src/application/auth/sessionManager.js";
import type { LocalAccount } from "../../src/domain/accounts.js";

const account: Pick<LocalAccount, "id" | "alias" | "role" | "grants" | "authRevision"> = {
  id: "acct-1",
  alias: "admin",
  role: "Administrator",
  grants: [],
  authRevision: 1
};

const other: Pick<LocalAccount, "id" | "alias" | "role" | "grants" | "authRevision"> = {
  id: "acct-2",
  alias: "viewer",
  role: "Viewer",
  grants: [],
  authRevision: 1
};

describe("SessionManager.sweepIdleSessions — Administrator-configurable inactivity timeout (ACCESS-CONTROL.md §5)", () => {
  it("locks an active session once it has been idle for at least the timeout", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);

    sessions.sweepIdleSessions(5 * 60_000, 10 * 60_000);
    expect(sessions.getBySender("sender-1")?.state).toBe("active");

    sessions.sweepIdleSessions(10 * 60_000, 10 * 60_000);
    expect(sessions.getBySender("sender-1")?.state).toBe("locked");
  });

  it("does not re-lock or otherwise disturb an already-locked session", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.lock("sender-1");

    sessions.sweepIdleSessions(999_000, 10 * 60_000);
    expect(sessions.getBySender("sender-1")?.state).toBe("locked");
  });

  it("touch() resets the idle clock so continued activity postpones the lock", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);

    sessions.touch("sender-1", 9 * 60_000);
    sessions.sweepIdleSessions(10 * 60_000, 10 * 60_000);
    expect(sessions.getBySender("sender-1")?.state).toBe("active");

    sessions.sweepIdleSessions(19 * 60_000, 10 * 60_000);
    expect(sessions.getBySender("sender-1")?.state).toBe("locked");
  });

  it("sweeps every session independently — one idle session locks without affecting an active one", () => {
    const sessions = new SessionManager();
    sessions.create("sender-idle", account, 0);
    sessions.create("sender-busy", other, 0);
    sessions.touch("sender-busy", 9 * 60_000);

    sessions.sweepIdleSessions(10 * 60_000, 10 * 60_000);

    expect(sessions.getBySender("sender-idle")?.state).toBe("locked");
    expect(sessions.getBySender("sender-busy")?.state).toBe("active");
  });
});

describe("SessionManager.lockAll — OS lock/suspend (ACCESS-CONTROL.md §5)", () => {
  it("locks every active session regardless of individual idle time", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.create("sender-2", other, 0);
    sessions.touch("sender-2", 0);

    sessions.lockAll();

    expect(sessions.getBySender("sender-1")?.state).toBe("locked");
    expect(sessions.getBySender("sender-2")?.state).toBe("locked");
  });

  it("leaves an already-locked session locked and does not fabricate sessions that don't exist", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.lock("sender-1");

    sessions.lockAll();

    expect(sessions.size()).toBe(1);
    expect(sessions.getBySender("sender-1")?.state).toBe("locked");
  });

  it("unlock() requires the caller to re-supply the sender's own session — it does not accept a different sender key", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.lockAll();

    expect(sessions.unlock("sender-2", 100)).toBeUndefined();
    const unlocked = sessions.unlock("sender-1", 100);
    expect(unlocked?.state).toBe("active");
    expect(unlocked?.accountId).toBe(account.id);
  });
});

describe("SessionManager — logout/account-switch isolation and revocation", () => {
  it("logout ends only the calling sender's session, not other senders' sessions for the same or a different account", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.create("sender-2", account, 0);

    sessions.logout("sender-1");

    expect(sessions.getBySender("sender-1")).toBeUndefined();
    expect(sessions.getBySender("sender-2")?.state).toBe("active");
  });

  it("a new login on the same sender key replaces any prior session (no stale-account bleed-through on account switch)", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.create("sender-1", other, 100);

    const current = sessions.getBySender("sender-1");
    expect(current?.accountId).toBe(other.id);
    expect(current?.role).toBe("Viewer");
    expect(sessions.size()).toBe(1);
  });

  it("revokeAllForAccount ends every session for that account only, leaving other accounts' sessions intact", () => {
    const sessions = new SessionManager();
    sessions.create("sender-1", account, 0);
    sessions.create("sender-2", account, 0);
    sessions.create("sender-3", other, 0);

    sessions.revokeAllForAccount(account.id);

    expect(sessions.getBySender("sender-1")).toBeUndefined();
    expect(sessions.getBySender("sender-2")).toBeUndefined();
    expect(sessions.getBySender("sender-3")?.accountId).toBe(other.id);
  });
});
