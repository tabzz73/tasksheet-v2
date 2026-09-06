import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Repositories } from "../ports.js";
import type { Clock } from "../clock.js";
import type { SessionManager } from "../auth/sessionManager.js";
import { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, verifyPassword } from "../auth/passwordHashing.js";
import { authorize, recordSecurityEvent, type AuthzDeps } from "../authorization.js";
import { CAPABILITIES, GRANTABLE_EDITOR_CAPABILITIES, type AccessRole, type Capability, type LocalAccount } from "../../domain/accounts.js";
import { newId } from "../ids.js";
import { runGuarded, validationError, conflictError, type UseCaseResult } from "../result.js";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** Never distinguishes "no such alias" from "wrong password" (ACCESS-CONTROL.md §5: no account enumeration). */
const GENERIC_LOGIN_FAILURE = "Incorrect login name or password.";
const ALIAS_SCHEMA = z.string().min(1, "Login name is required").max(64);
const PASSWORD_SCHEMA = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);

function accountDeps(repos: Repositories, sessions: SessionManager, clock: Clock): AuthzDeps {
  return { sessions, accounts: repos.accounts, securityEvents: repos.securityEvents, clock };
}

function generateRecoveryCode(): string {
  // 20 bytes of entropy, grouped for legibility (e.g. "A1B2-C3D4-...").
  const raw = randomBytes(20).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g)!.join("-");
}

function toPublicAccount(account: LocalAccount) {
  return {
    id: account.id,
    alias: account.alias,
    role: account.role,
    grants: account.grants,
    enabled: account.enabled,
    mustChangePassword: account.mustChangePassword,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}
export type PublicAccount = ReturnType<typeof toPublicAccount>;

export interface SessionSummary {
  alias: string;
  role: AccessRole;
  grants: readonly Capability[];
  mustChangePassword: boolean;
}

function summarize(account: LocalAccount): SessionSummary {
  return { alias: account.alias, role: account.role, grants: account.grants, mustChangePassword: account.mustChangePassword };
}

// --- Bootstrap ---------------------------------------------------------

export const BootstrapFirstAdminInput = z.object({ alias: ALIAS_SCHEMA, password: PASSWORD_SCHEMA });
export type BootstrapFirstAdminInput = z.input<typeof BootstrapFirstAdminInput>;

/** True only for a verified fresh store (ACCESS-CONTROL.md §5: "allowed only for a verified fresh store"). */
export function needsBootstrap(repos: Repositories): boolean {
  return repos.accounts.countAll() === 0;
}

export function bootstrapFirstAdmin(
  repos: Repositories,
  clock: Clock,
  rawInput: BootstrapFirstAdminInput
): Promise<UseCaseResult<{ account: PublicAccount; recoveryCode: string }>> {
  const parsed = BootstrapFirstAdminInput.safeParse(rawInput);
  if (!parsed.success) {
    return Promise.resolve(validationError(parsed.error.issues.map((i) => i.message).join("; ")));
  }
  if (!needsBootstrap(repos)) {
    return Promise.resolve(conflictError("An administrator already exists; bootstrap is only available on a fresh store."));
  }

  return (async () => {
    const passwordVerifier = await hashPassword(parsed.data.password);
    const recoveryCode = generateRecoveryCode();
    const recoveryVerifier = await hashPassword(recoveryCode);
    const now = clock.nowInstant();

    return runGuarded(() => {
      const { result } = repos.unitOfWork.runMutation(() => {
        const account: LocalAccount = {
          id: newId(),
          alias: parsed.data.alias,
          role: "Administrator",
          grants: [],
          enabled: true,
          mustChangePassword: false,
          authRevision: 1,
          createdAt: now,
          updatedAt: now
        };
        repos.accounts.create({ ...account, passwordVerifier });
        repos.recoveryCode.setVerifier(recoveryVerifier);
        repos.securityEvents.record({
          kind: "bootstrap_admin_created",
          actorAccountId: account.id,
          targetAccountId: account.id,
          reason: null,
          occurredAt: now
        });
        return { account: toPublicAccount(account), recoveryCode };
      });
      return result;
    });
  })();
}

// --- Login / session lifecycle -----------------------------------------

export const LoginInput = z.object({ alias: z.string().min(1), password: z.string().min(1) });
export type LoginInput = z.input<typeof LoginInput>;

export async function login(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: LoginInput
): Promise<UseCaseResult<SessionSummary>> {
  const parsed = LoginInput.safeParse(rawInput);
  if (!parsed.success) return validationError(GENERIC_LOGIN_FAILURE);

  const account = repos.accounts.findByAlias(parsed.data.alias);
  const now = clock.nowInstant();

  const lockout = account ? repos.loginLockouts.get(account.id) : null;
  if (lockout?.cooldownUntil && lockout.cooldownUntil > now) {
    return { kind: "forbidden", reason: GENERIC_LOGIN_FAILURE };
  }

  // Run a dummy hash comparison even for an unknown alias so response timing does not reveal account existence.
  const verifier = account ? repos.accounts.getPasswordVerifier(account.id)! : "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const passwordOk = await verifyPassword(parsed.data.password, verifier);

  if (!account || !account.enabled || !passwordOk) {
    if (account) {
      repos.loginLockouts.recordFailure(account.id, now, LOGIN_FAILURE_WINDOW_MS);
      recordSecurityEvent(accountDeps(repos, sessions, clock), "login_failure", account.id, account.id, null);
    }
    return { kind: "forbidden", reason: GENERIC_LOGIN_FAILURE };
  }

  repos.loginLockouts.clear(account.id);
  recordSecurityEvent(accountDeps(repos, sessions, clock), "login_success", account.id, account.id, null);
  sessions.create(senderKey, account, Date.now());
  return { kind: "success", value: summarize(account) };
}

export function logout(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): void {
  const session = sessions.getBySender(senderKey);
  if (session) recordSecurityEvent(accountDeps(repos, sessions, clock), "logout", session.accountId, session.accountId, null);
  sessions.logout(senderKey);
}

export function lock(sessions: SessionManager, senderKey: string): void {
  sessions.lock(senderKey);
}

export const UnlockInput = z.object({ password: z.string().min(1) });
export type UnlockInput = z.input<typeof UnlockInput>;

export async function unlock(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: UnlockInput
): Promise<UseCaseResult<SessionSummary>> {
  const parsed = UnlockInput.safeParse(rawInput);
  if (!parsed.success) return validationError("Password is required.");

  const session = sessions.getBySender(senderKey);
  if (!session) return { kind: "unauthenticated" };
  const account = repos.accounts.findById(session.accountId);
  if (!account || !account.enabled) {
    sessions.logout(senderKey);
    return { kind: "unauthenticated" };
  }

  const now = clock.nowInstant();
  const lockout = repos.loginLockouts.get(account.id);
  if (lockout?.cooldownUntil && lockout.cooldownUntil > now) {
    return { kind: "forbidden", reason: GENERIC_LOGIN_FAILURE };
  }

  const verifier = repos.accounts.getPasswordVerifier(account.id)!;
  const ok = await verifyPassword(parsed.data.password, verifier);
  if (!ok) {
    repos.loginLockouts.recordFailure(account.id, now, LOGIN_FAILURE_WINDOW_MS);
    return { kind: "forbidden", reason: GENERIC_LOGIN_FAILURE };
  }
  repos.loginLockouts.clear(account.id);
  sessions.unlock(senderKey, Date.now());
  recordSecurityEvent(accountDeps(repos, sessions, clock), "unlock", account.id, account.id, null);
  return { kind: "success", value: summarize(account) };
}

export function currentSession(repos: Repositories, sessions: SessionManager, senderKey: string): SessionSummary | null {
  const session = sessions.getBySender(senderKey);
  if (!session || session.state !== "active") return null;
  const account = repos.accounts.findById(session.accountId);
  if (!account || !account.enabled) return null;
  return summarize(account);
}

export type SessionStatus = { status: "none" } | { status: "locked"; alias: string } | { status: "active"; session: SessionSummary };

/** Distinguishes "no session" from "locked" so the renderer can show a Lock screen (with the alias) instead of a bare login form. */
export function sessionStatus(repos: Repositories, sessions: SessionManager, senderKey: string): SessionStatus {
  const session = sessions.getBySender(senderKey);
  if (!session) return { status: "none" };
  if (session.state === "locked") return { status: "locked", alias: session.alias };
  const account = repos.accounts.findById(session.accountId);
  if (!account || !account.enabled) return { status: "none" };
  return { status: "active", session: summarize(account) };
}

// --- Password management -------------------------------------------------

export const ChangeOwnPasswordInput = z.object({ currentPassword: z.string().min(1), newPassword: PASSWORD_SCHEMA });
export type ChangeOwnPasswordInput = z.input<typeof ChangeOwnPasswordInput>;

export async function changeOwnPassword(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: ChangeOwnPasswordInput
): Promise<UseCaseResult<SessionSummary>> {
  const parsed = ChangeOwnPasswordInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const session = sessions.getBySender(senderKey);
  if (!session) return { kind: "unauthenticated" };
  const account = repos.accounts.findById(session.accountId);
  if (!account || !account.enabled) {
    sessions.logout(senderKey);
    return { kind: "unauthenticated" };
  }

  const verifier = repos.accounts.getPasswordVerifier(account.id)!;
  const ok = await verifyPassword(parsed.data.currentPassword, verifier);
  if (!ok) return { kind: "forbidden", reason: "Current password is incorrect." };

  const newVerifier = await hashPassword(parsed.data.newPassword);

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      const newAuthRevision = account.authRevision + 1;
      repos.accounts.updatePasswordVerifier(account.id, newVerifier, newAuthRevision, false);
      // Revoke every session for this account (ACCESS-CONTROL.md §5), then
      // immediately re-establish the initiating sender's session — it just
      // proved current-password knowledge, so it is not the "affected
      // session elsewhere" the revocation targets.
      sessions.revokeAllForAccount(account.id);
      const refreshed = { ...account, authRevision: newAuthRevision };
      sessions.create(senderKey, refreshed, Date.now());
      recordSecurityEvent(accountDeps(repos, sessions, clock), "password_changed", account.id, account.id, null);
      return summarize(refreshed);
    });
    return result;
  });
}

// --- Administrator account management ------------------------------------

export const CreateAccountInput = z.object({
  alias: ALIAS_SCHEMA,
  password: PASSWORD_SCHEMA,
  role: z.enum(["Administrator", "Editor", "Viewer"]),
  grants: z.array(z.enum(CAPABILITIES)).default([])
});
export type CreateAccountInput = z.input<typeof CreateAccountInput>;

export async function createAccount(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: CreateAccountInput
): Promise<UseCaseResult<PublicAccount>> {
  const authz = authorize(accountDeps(repos, sessions, clock), senderKey, "accounts.manage");
  if (authz.kind !== "authorized") return authz;

  const parsed = CreateAccountInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));
  if (repos.accounts.findByAlias(parsed.data.alias)) {
    return conflictError(`Login name "${parsed.data.alias}" is already in use.`);
  }
  const grants = parsed.data.role === "Editor" ? parsed.data.grants.filter((g) => GRANTABLE_EDITOR_CAPABILITIES.includes(g)) : [];

  const passwordVerifier = await hashPassword(parsed.data.password);
  const now = clock.nowInstant();

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      const account: LocalAccount = {
        id: newId(),
        alias: parsed.data.alias,
        role: parsed.data.role,
        grants,
        enabled: true,
        // Unlike an admin *reset* (ACCESS-CONTROL.md §5), initial creation
        // does not force an immediate change — the admin-chosen password is
        // usable right away; the new user can change it themselves later.
        mustChangePassword: false,
        authRevision: 1,
        createdAt: now,
        updatedAt: now
      };
      repos.accounts.create({ ...account, passwordVerifier });
      recordSecurityEvent(accountDeps(repos, sessions, clock), "account_created", authz.session.accountId, account.id, parsed.data.role);
      return toPublicAccount(account);
    });
    return result;
  });
}

export const SetAccountRoleAndGrantsInput = z.object({
  targetAccountId: z.string().min(1),
  role: z.enum(["Administrator", "Editor", "Viewer"]),
  grants: z.array(z.enum(CAPABILITIES)).default([])
});
export type SetAccountRoleAndGrantsInput = z.input<typeof SetAccountRoleAndGrantsInput>;

export function setAccountRoleAndGrants(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: SetAccountRoleAndGrantsInput
): UseCaseResult<PublicAccount> {
  const authz = authorize(accountDeps(repos, sessions, clock), senderKey, "accounts.manage");
  if (authz.kind !== "authorized") return authz;

  const parsed = SetAccountRoleAndGrantsInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const target = repos.accounts.findById(parsed.data.targetAccountId);
  if (!target) return validationError("Unknown account.");

  if (target.role === "Administrator" && target.enabled && parsed.data.role !== "Administrator" && repos.accounts.countEnabledAdministrators() <= 1) {
    return conflictError("Cannot demote the last enabled Administrator.");
  }

  const grants = parsed.data.role === "Editor" ? parsed.data.grants.filter((g) => GRANTABLE_EDITOR_CAPABILITIES.includes(g)) : [];

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      const newAuthRevision = target.authRevision + 1;
      repos.accounts.updateRoleAndGrants(target.id, parsed.data.role, grants, newAuthRevision);
      sessions.revokeAllForAccount(target.id);
      recordSecurityEvent(accountDeps(repos, sessions, clock), "account_role_changed", authz.session.accountId, target.id, parsed.data.role);
      return toPublicAccount({ ...target, role: parsed.data.role, grants, authRevision: newAuthRevision });
    });
    return result;
  });
}

export const SetAccountEnabledInput = z.object({ targetAccountId: z.string().min(1), enabled: z.boolean() });
export type SetAccountEnabledInput = z.input<typeof SetAccountEnabledInput>;

export function setAccountEnabled(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: SetAccountEnabledInput
): UseCaseResult<PublicAccount> {
  const authz = authorize(accountDeps(repos, sessions, clock), senderKey, "accounts.manage");
  if (authz.kind !== "authorized") return authz;

  const parsed = SetAccountEnabledInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const target = repos.accounts.findById(parsed.data.targetAccountId);
  if (!target) return validationError("Unknown account.");

  if (!parsed.data.enabled && target.role === "Administrator" && target.enabled && repos.accounts.countEnabledAdministrators() <= 1) {
    return conflictError("Cannot disable the last enabled Administrator.");
  }

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      const newAuthRevision = target.authRevision + 1;
      repos.accounts.setEnabled(target.id, parsed.data.enabled, newAuthRevision);
      if (!parsed.data.enabled) sessions.revokeAllForAccount(target.id);
      recordSecurityEvent(
        accountDeps(repos, sessions, clock),
        parsed.data.enabled ? "account_enabled" : "account_disabled",
        authz.session.accountId,
        target.id,
        null
      );
      return toPublicAccount({ ...target, enabled: parsed.data.enabled, authRevision: newAuthRevision });
    });
    return result;
  });
}

export const AdminResetPasswordInput = z.object({
  adminCurrentPassword: z.string().min(1),
  targetAccountId: z.string().min(1),
  newPassword: PASSWORD_SCHEMA
});
export type AdminResetPasswordInput = z.input<typeof AdminResetPasswordInput>;

export async function adminResetPassword(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  senderKey: string,
  rawInput: AdminResetPasswordInput
): Promise<UseCaseResult<PublicAccount>> {
  const authz = authorize(accountDeps(repos, sessions, clock), senderKey, "accounts.manage");
  if (authz.kind !== "authorized") return authz;

  const parsed = AdminResetPasswordInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  // Fresh reauthentication for a security-sensitive action (ACCESS-CONTROL.md §5).
  const actor = repos.accounts.findById(authz.session.accountId)!;
  const actorVerifier = repos.accounts.getPasswordVerifier(actor.id)!;
  const reauthOk = await verifyPassword(parsed.data.adminCurrentPassword, actorVerifier);
  if (!reauthOk) return { kind: "forbidden", reason: "Reauthentication failed." };

  const target = repos.accounts.findById(parsed.data.targetAccountId);
  if (!target) return validationError("Unknown account.");

  const newVerifier = await hashPassword(parsed.data.newPassword);

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      const newAuthRevision = target.authRevision + 1;
      repos.accounts.updatePasswordVerifier(target.id, newVerifier, newAuthRevision, true);
      sessions.revokeAllForAccount(target.id);
      recordSecurityEvent(accountDeps(repos, sessions, clock), "password_reset_by_admin", actor.id, target.id, null);
      return toPublicAccount({ ...target, authRevision: newAuthRevision, mustChangePassword: true });
    });
    return result;
  });
}

export const RecoverWithCodeInput = z.object({ code: z.string().min(1), newAdminPassword: PASSWORD_SCHEMA });
export type RecoverWithCodeInput = z.input<typeof RecoverWithCodeInput>;

export async function recoverWithCode(
  repos: Repositories,
  sessions: SessionManager,
  clock: Clock,
  rawInput: RecoverWithCodeInput
): Promise<UseCaseResult<{ account: PublicAccount; recoveryCode: string }>> {
  const parsed = RecoverWithCodeInput.safeParse(rawInput);
  if (!parsed.success) return validationError(parsed.error.issues.map((i) => i.message).join("; "));

  const verifier = repos.recoveryCode.getVerifier();
  if (!verifier) return { kind: "forbidden", reason: "Recovery is not available." };
  const ok = await verifyPassword(parsed.data.code, verifier);
  if (!ok) return { kind: "forbidden", reason: "Invalid or expired recovery code." };

  const admin = repos.accounts.listAll().find((a) => a.role === "Administrator");
  if (!admin) return { kind: "storage", message: "No administrator account exists to recover." };

  const newVerifier = await hashPassword(parsed.data.newAdminPassword);
  const newRecoveryCode = generateRecoveryCode();
  const newRecoveryVerifier = await hashPassword(newRecoveryCode);

  return runGuarded(() => {
    const { result } = repos.unitOfWork.runMutation(() => {
      const newAuthRevision = admin.authRevision + 1;
      repos.accounts.updatePasswordVerifier(admin.id, newVerifier, newAuthRevision, false);
      repos.accounts.setEnabled(admin.id, true, newAuthRevision);
      repos.recoveryCode.setVerifier(newRecoveryVerifier);
      sessions.revokeAllForAccount(admin.id);
      recordSecurityEvent(accountDeps(repos, sessions, clock), "recovery_used", admin.id, admin.id, null);
      return { account: toPublicAccount({ ...admin, authRevision: newAuthRevision, enabled: true }), recoveryCode: newRecoveryCode };
    });
    return result;
  });
}

export function listAccounts(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string): UseCaseResult<readonly PublicAccount[]> {
  const authz = authorize(accountDeps(repos, sessions, clock), senderKey, "accounts.manage");
  if (authz.kind !== "authorized") return authz;
  return { kind: "success", value: repos.accounts.listAll().map(toPublicAccount) };
}

export function listSecurityEvents(repos: Repositories, sessions: SessionManager, clock: Clock, senderKey: string, limit = 100) {
  const authz = authorize(accountDeps(repos, sessions, clock), senderKey, "security.audit.read");
  if (authz.kind !== "authorized") return authz;
  return { kind: "success" as const, value: repos.securityEvents.listRecent(limit) };
}
