import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { openDatabase } from "../../src/infra/db/connection.js";
import { createSqliteRepositories } from "../../src/infra/db/sqliteRepositories.js";
import type { Repositories } from "../../src/application/ports.js";
import { FixedClock } from "../../src/application/clock.js";
import { SessionManager } from "../../src/application/auth/sessionManager.js";
import {
  bootstrapFirstAdmin,
  needsBootstrap,
  login,
  logout,
  lock,
  unlock,
  currentSession,
  changeOwnPassword,
  createAccount,
  setAccountRoleAndGrants,
  setAccountEnabled,
  adminResetPassword,
  recoverWithCode,
  listAccounts,
  listSecurityEvents
} from "../../src/application/useCases/auth.js";

let dir: string;
let db: Database.Database;
let repos: Repositories;
let sessions: SessionManager;
const clock = new FixedClock("2026-09-05T12:00:00.000Z" as never);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tasksheet-auth-test-"));
  db = openDatabase(join(dir, "tasksheet.sqlite"));
  repos = createSqliteRepositories(db);
  sessions = new SessionManager();
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

async function bootstrapAdmin(alias = "admin", password = "correct horse battery staple") {
  const result = await bootstrapFirstAdmin(repos, clock, { alias, password });
  if (result.kind !== "success") throw new Error(`bootstrap failed: ${JSON.stringify(result)}`);
  return result.value;
}

describe("AC-44: first-admin enrollment and offline login", () => {
  it("needs bootstrap on a fresh store, and not after one admin exists", async () => {
    expect(needsBootstrap(repos)).toBe(true);
    await bootstrapAdmin();
    expect(needsBootstrap(repos)).toBe(false);
  });

  it("rejects a second bootstrap attempt once an admin exists", async () => {
    await bootstrapAdmin();
    const second = await bootstrapFirstAdmin(repos, clock, { alias: "admin2", password: "another long password 123" });
    expect(second.kind).toBe("conflict");
  });

  it("logs in with the enrolled admin and restart (fresh SessionManager) requires login again", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    const result = await login(repos, sessions, clock, "sender-1", { alias: "admin", password: "correct horse battery staple" });
    expect(result.kind).toBe("success");
    expect(currentSession(repos, sessions, "sender-1")?.role).toBe("Administrator");

    // Simulate app restart: a new SessionManager has no memory of any session.
    const freshSessions = new SessionManager();
    expect(currentSession(repos, freshSessions, "sender-1")).toBeNull();
  });

  it("rejects an unknown alias and a wrong password with the same generic message (no enumeration)", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    const unknownAlias = await login(repos, sessions, clock, "s1", { alias: "nobody", password: "whatever-password-here" });
    const wrongPassword = await login(repos, sessions, clock, "s2", { alias: "admin", password: "totally-wrong-password" });
    expect(unknownAlias.kind).toBe("forbidden");
    expect(wrongPassword.kind).toBe("forbidden");
    expect((unknownAlias as { reason: string }).reason).toBe((wrongPassword as { reason: string }).reason);
  });
});

describe("AC-48: password hashing, lockout, reset and recovery", () => {
  it("stores an Argon2id verifier, never the plaintext password", async () => {
    const admin = await bootstrapAdmin();
    const verifier = repos.accounts.getPasswordVerifier(admin.account.id)!;
    expect(verifier.startsWith("$argon2id$")).toBe(true);
    expect(verifier).not.toContain("correct horse battery staple");
  });

  it("locks out after 5 failed attempts within the window with an escalating cooldown", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    for (let i = 0; i < 5; i++) {
      await login(repos, sessions, clock, "s1", { alias: "admin", password: "wrong-password-attempt" });
    }
    const stillLockedOut = await login(repos, sessions, clock, "s1", { alias: "admin", password: "correct horse battery staple" });
    expect(stillLockedOut.kind).toBe("forbidden");
  });

  it("a successful login clears the failure counter", async () => {
    const admin = await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "s1", { alias: "admin", password: "wrong-password-attempt" });
    await login(repos, sessions, clock, "s1", { alias: "admin", password: "wrong-password-attempt" });
    const ok = await login(repos, sessions, clock, "s1", { alias: "admin", password: "correct horse battery staple" });
    expect(ok.kind).toBe("success");
    expect(repos.loginLockouts.get(admin.account.id)?.failedAttempts ?? 0).toBe(0);
  });

  it("own password change requires the current password and revokes other sessions", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "s1", { alias: "admin", password: "correct horse battery staple" });
    await login(repos, sessions, clock, "s2", { alias: "admin", password: "correct horse battery staple" });

    const wrongCurrent = await changeOwnPassword(repos, sessions, clock, "s1", {
      currentPassword: "not-the-current-password",
      newPassword: "brand new password for admin"
    });
    expect(wrongCurrent.kind).toBe("forbidden");

    const changed = await changeOwnPassword(repos, sessions, clock, "s1", {
      currentPassword: "correct horse battery staple",
      newPassword: "brand new password for admin"
    });
    expect(changed.kind).toBe("success");

    // s1 (the initiator) keeps access; s2 (another session for the same account) is revoked.
    expect(currentSession(repos, sessions, "s1")).not.toBeNull();
    expect(currentSession(repos, sessions, "s2")).toBeNull();
  });

  it("admin reset forces mustChangePassword and revokes the target's sessions", async () => {
    const admin = await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
    const created = await createAccount(repos, sessions, clock, "admin-sender", {
      alias: "editor1",
      password: "editor one starting password",
      role: "Editor",
      grants: []
    });
    if (created.kind !== "success") throw new Error("setup failed");
    await login(repos, sessions, clock, "editor-sender", { alias: "editor1", password: "editor one starting password" });

    const reset = await adminResetPassword(repos, sessions, clock, "admin-sender", {
      adminCurrentPassword: "correct horse battery staple",
      targetAccountId: created.value.id,
      newPassword: "a completely new editor password"
    });
    expect(reset.kind).toBe("success");
    expect(currentSession(repos, sessions, "editor-sender")).toBeNull();
    void admin;
  });

  it("admin reset requires the ACTING admin's own current password (fresh reauthentication) — being merely logged in as admin is not enough", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
    const created = await createAccount(repos, sessions, clock, "admin-sender", {
      alias: "editor1",
      password: "editor one starting password",
      role: "Editor",
      grants: []
    });
    if (created.kind !== "success") throw new Error("setup failed");

    const wrongReauth = await adminResetPassword(repos, sessions, clock, "admin-sender", {
      adminCurrentPassword: "definitely-not-the-admin-password",
      targetAccountId: created.value.id,
      newPassword: "a completely new editor password"
    });
    expect(wrongReauth.kind).toBe("forbidden");

    // The target's password/verifier must be unchanged after a failed reauth attempt.
    const stillOldPassword = await login(repos, sessions, clock, "editor-sender", {
      alias: "editor1",
      password: "editor one starting password"
    });
    expect(stillOldPassword.kind).toBe("success");
  });

  it("recovery code resets the admin password once and rotates itself", async () => {
    const { recoveryCode } = await bootstrapAdmin("admin", "correct horse battery staple");
    const recovered = await recoverWithCode(repos, sessions, clock, { code: recoveryCode, newAdminPassword: "post recovery admin password" });
    expect(recovered.kind).toBe("success");

    const canLoginWithNew = await login(repos, sessions, clock, "s1", { alias: "admin", password: "post recovery admin password" });
    expect(canLoginWithNew.kind).toBe("success");

    // The old code is single-use: it must fail the second time.
    const reuseAttempt = await recoverWithCode(repos, sessions, clock, { code: recoveryCode, newAdminPassword: "another password entirely" });
    expect(reuseAttempt.kind).toBe("forbidden");
  });
});

describe("AC-47: last-admin protection", () => {
  it("refuses to demote the last enabled Administrator", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
    const adminAccount = repos.accounts.findByAlias("admin")!;

    const result = setAccountRoleAndGrants(repos, sessions, clock, "admin-sender", {
      targetAccountId: adminAccount.id,
      role: "Viewer",
      grants: []
    });
    expect(result.kind).toBe("conflict");
  });

  it("refuses to disable the last enabled Administrator", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
    const adminAccount = repos.accounts.findByAlias("admin")!;

    const result = setAccountEnabled(repos, sessions, clock, "admin-sender", { targetAccountId: adminAccount.id, enabled: false });
    expect(result.kind).toBe("conflict");
  });

  it("allows demoting an admin once a second enabled Administrator exists", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
    const secondAdmin = await createAccount(repos, sessions, clock, "admin-sender", {
      alias: "admin2",
      password: "second admin starting password",
      role: "Administrator",
      grants: []
    });
    if (secondAdmin.kind !== "success") throw new Error("setup failed");

    const adminAccount = repos.accounts.findByAlias("admin")!;
    const result = setAccountRoleAndGrants(repos, sessions, clock, "admin-sender", {
      targetAccountId: adminAccount.id,
      role: "Editor",
      grants: []
    });
    expect(result.kind).toBe("success");
  });
});

describe("account administration is itself capability-gated", () => {
  it("a non-admin cannot manage accounts or read the security audit", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "admin-sender", { alias: "admin", password: "correct horse battery staple" });
    const editor = await createAccount(repos, sessions, clock, "admin-sender", {
      alias: "editor1",
      password: "editor one starting password",
      role: "Editor",
      grants: []
    });
    if (editor.kind !== "success") throw new Error("setup failed");
    await login(repos, sessions, clock, "editor-sender", { alias: "editor1", password: "editor one starting password" });

    const listResult = listAccounts(repos, sessions, clock, "editor-sender");
    expect(listResult.kind).toBe("forbidden");

    const auditResult = listSecurityEvents(repos, sessions, clock, "editor-sender");
    expect(auditResult.kind).toBe("forbidden");

    const createResult = await createAccount(repos, sessions, clock, "editor-sender", {
      alias: "editor2",
      password: "editor two starting password",
      role: "Viewer",
      grants: []
    });
    expect(createResult.kind).toBe("forbidden");
  });

  it("an unauthenticated sender cannot manage accounts", () => {
    const result = listAccounts(repos, sessions, clock, "nobody-here");
    expect(result.kind).toBe("unauthenticated");
  });
});

describe("AC-49: lock/logout session lifecycle", () => {
  it("lock blocks further access until unlock with the correct password", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "s1", { alias: "admin", password: "correct horse battery staple" });
    lock(sessions, "s1");
    expect(currentSession(repos, sessions, "s1")).toBeNull();

    const wrongUnlock = await unlock(repos, sessions, clock, "s1", { password: "wrong" });
    expect(wrongUnlock.kind).toBe("forbidden");
    expect(currentSession(repos, sessions, "s1")).toBeNull();

    const rightUnlock = await unlock(repos, sessions, clock, "s1", { password: "correct horse battery staple" });
    expect(rightUnlock.kind).toBe("success");
    expect(currentSession(repos, sessions, "s1")).not.toBeNull();
  });

  it("logout ends the session for that sender only", async () => {
    await bootstrapAdmin("admin", "correct horse battery staple");
    await login(repos, sessions, clock, "s1", { alias: "admin", password: "correct horse battery staple" });
    await login(repos, sessions, clock, "s2", { alias: "admin", password: "correct horse battery staple" });
    logout(repos, sessions, clock, "s1");
    expect(currentSession(repos, sessions, "s1")).toBeNull();
    expect(currentSession(repos, sessions, "s2")).not.toBeNull();
  });
});
