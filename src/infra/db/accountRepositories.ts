import type Database from "better-sqlite3";
import type {
  AccountRepository,
  LoginLockoutRepository,
  RecoveryCodeRepository,
  SecurityEventRepository
} from "../../application/ports.js";
import type { AccessRole, Capability, LocalAccount, LoginLockoutState, SecurityEvent, SecurityEventKind } from "../../domain/accounts.js";
import type { Id, Instant } from "../../domain/types.js";

function toBool(value: number): boolean {
  return value === 1;
}
function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: Database.Database) {}

  private map(row: Record<string, unknown>): LocalAccount {
    return {
      id: row.id as string,
      alias: row.alias as string,
      role: row.role as AccessRole,
      grants: JSON.parse(row.grants_json as string) as Capability[],
      enabled: toBool(row.enabled as number),
      mustChangePassword: toBool(row.must_change_password as number),
      authRevision: row.auth_revision as number,
      createdAt: row.created_at as Instant,
      updatedAt: row.updated_at as Instant
    };
  }

  countEnabledAdministrators(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM accounts WHERE role = 'Administrator' AND enabled = 1")
      .get() as { n: number };
    return row.n;
  }

  countAll(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number };
    return row.n;
  }

  findById(id: Id): LocalAccount | null {
    const row = this.db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.map(row) : null;
  }

  findByAlias(alias: string): LocalAccount | null {
    const row = this.db.prepare("SELECT * FROM accounts WHERE alias = ? COLLATE NOCASE").get(alias) as
      | Record<string, unknown>
      | undefined;
    return row ? this.map(row) : null;
  }

  listAll(): readonly LocalAccount[] {
    return (this.db.prepare("SELECT * FROM accounts ORDER BY alias COLLATE NOCASE").all() as Record<string, unknown>[]).map(
      (r) => this.map(r)
    );
  }

  create(account: LocalAccount & { passwordVerifier: string }): void {
    this.db
      .prepare(
        `INSERT INTO accounts (id, alias, role, grants_json, password_verifier, enabled, must_change_password, auth_revision, created_at, updated_at)
         VALUES (@id, @alias, @role, @grantsJson, @passwordVerifier, @enabled, @mustChangePassword, @authRevision, @createdAt, @updatedAt)`
      )
      .run({
        id: account.id,
        alias: account.alias,
        role: account.role,
        grantsJson: JSON.stringify(account.grants),
        passwordVerifier: account.passwordVerifier,
        enabled: fromBool(account.enabled),
        mustChangePassword: fromBool(account.mustChangePassword),
        authRevision: account.authRevision,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      });
  }

  updatePasswordVerifier(id: Id, passwordVerifier: string, newAuthRevision: number, mustChangePassword: boolean): void {
    this.db
      .prepare(
        "UPDATE accounts SET password_verifier = ?, auth_revision = ?, must_change_password = ?, updated_at = ? WHERE id = ?"
      )
      .run(passwordVerifier, newAuthRevision, fromBool(mustChangePassword), new Date().toISOString(), id);
  }

  getPasswordVerifier(id: Id): string | null {
    const row = this.db.prepare("SELECT password_verifier FROM accounts WHERE id = ?").get(id) as
      | { password_verifier: string }
      | undefined;
    return row ? row.password_verifier : null;
  }

  updateRoleAndGrants(id: Id, role: AccessRole, grants: readonly Capability[], newAuthRevision: number): void {
    this.db
      .prepare("UPDATE accounts SET role = ?, grants_json = ?, auth_revision = ?, updated_at = ? WHERE id = ?")
      .run(role, JSON.stringify(grants), newAuthRevision, new Date().toISOString(), id);
  }

  setEnabled(id: Id, enabled: boolean, newAuthRevision: number): void {
    this.db
      .prepare("UPDATE accounts SET enabled = ?, auth_revision = ?, updated_at = ? WHERE id = ?")
      .run(fromBool(enabled), newAuthRevision, new Date().toISOString(), id);
  }
}

export class SqliteLoginLockoutRepository implements LoginLockoutRepository {
  constructor(private readonly db: Database.Database) {}

  get(accountId: Id): LoginLockoutState | null {
    const row = this.db.prepare("SELECT * FROM login_lockouts WHERE account_id = ?").get(accountId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      accountId,
      failedAttempts: row.failed_attempts as number,
      windowStartedAt: (row.window_started_at as Instant | null) ?? null,
      cooldownUntil: (row.cooldown_until as Instant | null) ?? null
    };
  }

  recordFailure(accountId: Id, nowIso: string, windowMs: number): LoginLockoutState {
    const existing = this.get(accountId);
    const windowStart =
      existing?.windowStartedAt && new Date(nowIso).getTime() - new Date(existing.windowStartedAt).getTime() < windowMs
        ? existing.windowStartedAt
        : nowIso;
    const failedAttempts = windowStart === existing?.windowStartedAt ? (existing?.failedAttempts ?? 0) + 1 : 1;

    // Escalating cooldown: 30s at the 5th failure in-window, doubling up to a 15-minute cap.
    let cooldownUntil: string | null = existing?.cooldownUntil ?? null;
    if (failedAttempts >= 5) {
      const overBy = failedAttempts - 5;
      const seconds = Math.min(30 * 2 ** overBy, 15 * 60);
      cooldownUntil = new Date(new Date(nowIso).getTime() + seconds * 1000).toISOString();
    }

    this.db
      .prepare(
        `INSERT INTO login_lockouts (account_id, failed_attempts, window_started_at, cooldown_until)
         VALUES (@accountId, @failedAttempts, @windowStart, @cooldownUntil)
         ON CONFLICT(account_id) DO UPDATE SET
           failed_attempts = excluded.failed_attempts,
           window_started_at = excluded.window_started_at,
           cooldown_until = excluded.cooldown_until`
      )
      .run({ accountId, failedAttempts, windowStart, cooldownUntil });

    return { accountId, failedAttempts, windowStartedAt: windowStart as Instant, cooldownUntil: cooldownUntil as Instant | null };
  }

  clear(accountId: Id): void {
    this.db
      .prepare(
        `INSERT INTO login_lockouts (account_id, failed_attempts, window_started_at, cooldown_until)
         VALUES (?, 0, NULL, NULL)
         ON CONFLICT(account_id) DO UPDATE SET failed_attempts = 0, window_started_at = NULL, cooldown_until = NULL`
      )
      .run(accountId);
  }
}

export class SqliteSecurityEventRepository implements SecurityEventRepository {
  constructor(private readonly db: Database.Database) {}

  record(event: {
    kind: SecurityEventKind;
    actorAccountId: Id | null;
    targetAccountId: Id | null;
    reason: string | null;
    occurredAt: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO security_events (id, kind, actor_account_id, target_account_id, reason, occurred_at)
         VALUES (@id, @kind, @actorAccountId, @targetAccountId, @reason, @occurredAt)`
      )
      .run({ id: `sec_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...event });
  }

  listRecent(limit: number): readonly SecurityEvent[] {
    return (
      this.db.prepare("SELECT * FROM security_events ORDER BY occurred_at DESC LIMIT ?").all(limit) as Record<
        string,
        unknown
      >[]
    ).map((row) => ({
      id: row.id as string,
      kind: row.kind as SecurityEventKind,
      actorAccountId: (row.actor_account_id as string | null) ?? null,
      targetAccountId: (row.target_account_id as string | null) ?? null,
      reason: (row.reason as string | null) ?? null,
      occurredAt: row.occurred_at as Instant
    }));
  }
}

export class SqliteRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly db: Database.Database) {}

  setVerifier(verifier: string | null): void {
    this.db.prepare("UPDATE recovery_code SET verifier = ? WHERE id = 1").run(verifier);
  }

  getVerifier(): string | null {
    const row = this.db.prepare("SELECT verifier FROM recovery_code WHERE id = 1").get() as { verifier: string | null };
    return row.verifier;
  }
}
