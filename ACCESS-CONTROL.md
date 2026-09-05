# TaskSheet V2 — Local users, CRUD and permissions

Status: implementation baseline 4, 2026-09-05. User requested local accounts and access permissions. Delegated by PRD.md and ARCHITECTURE.md; supersedes only the prior blanket ban on minimal application account data, as recorded by ADR-0002. All other employee-data restrictions remain.

## 1. Local accounts and data boundary

Require offline local sign-in before exposing facility/resident data. Application access roles are Administrator, Editor and Viewer. HCA/LPN/RN are care-output roles and confer no application privilege. A local account is not a staff roster entry. Store only account ID, chosen login name, password verifier, access role, explicit permitted overrides, enabled/reset-required state, auth revision, security timestamps and bounded failed-login metadata. Use aliases; do not auto-copy Windows usernames or collect legal name, email, phone, employee number, job credentials, payroll or staff schedules.

Security audit events may reference account IDs for access/change accountability. They are not clinical completion records or performance reports. Login names appear only in sign-in, current-session identity and authorized account administration. Ordinary printouts, care records and exported diagnostics exclude them. Account passwords, verifier hashes, recovery verifiers and sessions never appear in UI list DTOs, logs, screenshots or logical data exports.

## 2. Access defaults

Legend: Yes = permitted by default; Grant = denied until an Administrator enables that specific Editor capability; No = unavailable to that role. Viewer is always business-read-only; selecting print options or transient filters is allowed, but saving shared presets/settings is not.

| Operation | Administrator | Editor | Viewer |
| --- | --- | --- | --- |
| View operational data, dashboard, huddle and normal reports | Yes | Yes | Yes |
| Preview and print authorized operational documents | Yes | Yes | Yes |
| Create/edit residents, placement, care/unit tasks, FYIs, attention, wounds, bathing | Yes | Yes | No |
| Record ordinary resident away/return status; complete allowed follow-up transition | Yes | Yes | No |
| Archive/delete resident or care/unit task/FYI/attention; mark resident departed/deceased | Yes | Grant per resource | No |
| Heal/inactivate wound, suppress linked work; deactivate/reactivate bathing assignments | Yes | Grant per resource | No |
| Create/edit/deactivate rooms, beds, shifts and assignment configuration | Yes | Grant per resource/action | No |
| Create/edit care tasks catalog/modifiers or wound supplies catalog | Yes | Grant per catalog | No |
| Delete/deactivate catalog entries | Yes | Grant per catalog, with dependency checks | No |
| Edit facility identity/timezone, global print defaults or operational configuration | Yes | No | No |
| Save/update/delete shared report presets | Yes | Grant per action | No |
| Export care-task catalog | Yes | Grant | No |
| Export wound-supply catalog | Yes | Grant | No |
| Import/add/update care-task catalog | Yes | Grant plus catalog create/update | No |
| Import/add/update wound-supply catalog | Yes | Grant plus catalog create/update | No |
| Replace catalog scope | Yes | Grant plus catalog import and deactivate rights | No |
| CSV/Excel/JSON operational report export | Yes | Grant per report scope | No |
| Whole Database logical export or native backup | Yes | No | No |
| Whole Database import/restore, bulk demo/import cleanup, factory reset | Yes | No | No |
| Account creation, roles/grants, password reset, account disable/enable | Yes | No | No |
| Read/export security audit | Yes | No | No |
| Own password change, lock and logout | Yes | Yes | Yes |

Print permits OS Print to PDF where available; Viewer is view-and-print, not an anti-copy security boundary. If a facility requires screen-only access, that is a separate approved role/policy, not a hidden restriction in this baseline.

Viewer print operations may append trusted generation/security bookkeeping, but cannot update shared FYI binder last-printed baselines, shared presets or facility defaults. Updating a shared binder print baseline requires Editor operational-update rights or Administrator. Distinguish immutable read-model generation from trusted service bookkeeping; do not grant a generic write capability to make printing work.

An Administrator can grant/revoke only the explicitly grantable Editor capabilities above. No wildcard permissions, user-defined role scripting, inherited care-role privileges or Editor account administration. A Viewer needing editing must be explicitly reassigned to Editor. Role changes clear incompatible overrides and revoke sessions. Administrator is still subject to validation, reference constraints, last-admin protection and confirmations.

## 3. CRUD lifecycle matrix

| Resource | Create/read/update behavior | Delete/deactivate behavior |
| --- | --- | --- |
| Facility | First-run creates singleton; authorized settings updates | No ordinary Delete facility; explicit admin reset/restore workflow only |
| Rooms/beds | Stable IDs; placement constraints on updates | Reject occupied/referenced hard deletion; deactivate only after placement review |
| Residents | Create profile, view history, edit reviewed fields/placement | Departure/deceased/archive are retained states; hard-delete only unreferenced accidental records after review |
| Shifts | Add, edit, review assignment impact | Deactivate referenced shifts; block hard delete while referenced |
| Resident/unit tasks | Create snapshot/schedule; edit via schedule revision | Stop future work using effective deactivation; retain history; delete only unreferenced unused records |
| Catalogs/modifiers/supplies | Version updates and code uniqueness; snapshot stability | Deactivate referenced entries; never cascade into resident data or snapshots |
| FYIs/attention | Scope/effective dates/visibility editable | Archive/expire preserves required history; hard delete only if unreferenced |
| Wounds | Own registry; reviewed amendments | Heal/inactivate uses exact linked-work transition; history immutable through normal CRUD |
| Bathing | Proposal read-only until confirm; changes reviewed | Remove future assignments under grant; respect locks and preserve past history |
| Follow-up | Occurrence materialization by validated service; status command | No generic delete/history erase; terminal/reopen transitions per DATA-CONTRACTS |
| Print presets | Save/update shared definitions under grant | Delete preset only; generated document content unaffected |
| Accounts | Admin creates/updates role and enabled state; user changes own password | Disable instead of delete once used; keep audit references; never remove last enabled Administrator |
| Security/operational audit | Append by trusted services; admin-readable security log | No UI CRUD edits/deletes or clearing through demo cleanup |

All delete/deactivate operations require a centered confirmation naming scope and consequences. Lifecycle actions that suppress work require their dedicated permission even when invoked through a generic Edit form, import, bulk command or status dropdown. `done`/`no_longer_needed` are follow-up continuity transitions, not authorization to delete a task. Only Administrator can bulk-clear data. No bypass through cascade deletion.

## 4. Main-process authorization contract

Default deny. Main-process services bind the active session to the validated Electron sender/frame and trusted account record. Never trust renderer-supplied actor IDs, role flags, grants or merely hidden buttons. Authorize every data query, mutation, preview, print, export, import preview/commit, account command and recovery operation. Validate source/target resource scope and effective capability before opening a sensitive file or querying data.

Use allow-listed capabilities such as `resident.create`, `resident.update`, `resident.archive`, `wound.transition`, `catalog.care.import`, `catalog.supplies.export`, `database.restore`, `accounts.manage`; map every command to a capability. Unknown commands/capabilities fail closed. Recheck account enabled state, auth revision and permissions immediately before committing or releasing generated exports. Serialize role changes with mutations so a revocation has a definite boundary. A current transaction admitted before revocation may finish; subsequent requests must be denied.

Retry deduplication keys include installation/account ID plus command ID. Authenticate/authorize first, then return any authorized cached command result. A revoked account cannot recover sensitive prior results through a replay. Import previews bind account ID, auth revision, data revision and file fingerprint; permissions are checked again on confirmation. Derived operations require the combined permissions for their actual effects.

Return `unauthenticated`, `forbidden`, `validation`, `conflict` or `storage` without leaking whether inaccessible records exist. UI uses a centered session-expired/access-denied dialog and preserves drafts only for the same user while locked. No credentials or sessions in renderer persistence.

## 5. First run, login and sessions

Clean installation creates the first Administrator and a unique login before facility setup; there are no default passwords, shared demo credentials or guest access to clinical data. Bootstrap is a single transaction and is allowed only for a verified fresh store. A recognized pre-auth legacy database uses a documented owner-attended migration bootstrap before data access; a current database missing accounts is corruption/recovery, never automatic admin recreation.

Password policy: 15–128 characters, allow spaces/paste/password managers, never silently trim or truncate passwords; no arbitrary composition requirements. Store a salted Argon2id verifier with parameters at least 19 MiB memory, 2 iterations, parallelism 1, benchmarked upward where practical. Never plaintext, reversible password encryption or a fast unsalted hash. Persist only the verifier and needed parameters/salt; clear plaintext references after use as far as runtime permits.

Login uses a generic failure message and bounded escalating delays for repeated failed attempts; no account enumeration through UI errors. Account delays survive restart. Implement at least a 30-second account cooldown after 5 failures in a 15-minute window, increasing on continued failures up to 15 minutes; add a bounded global attempt limiter to prevent username rotation flooding. Successful login/reset clears appropriate counters and security logging excludes attempted passwords.

Main process owns in-memory sessions; app restart requires sign-in. Provide Lock and Logout. Default inactivity lock is 10 minutes, configurable by Administrator from 5–60 minutes. Lock on OS session lock/suspend; after resume require reauthentication. Dirty forms do not prevent a privacy lock: hide all data and retain the draft only in memory for the same account. Logout/account switch prompts save/discard before clearing all view models and drafts; another account never inherits them. Revoked/disabled sessions lose data access immediately; no save permitted with revoked authority.

Own-password change requires current password. Admin resets require admin reauthentication and force password change before the reset user can access data. Disable, grant changes, password reset/change and recovery revoke affected sessions. Administrative restore, account/grant changes and bulk data removal require fresh admin reauthentication (within 5 minutes) plus consequence confirmation. No password prompt inside another form; use the shared centered secure dialog.

## 6. Recovery and last-admin protection

Prevent disabling, deleting or demoting the last enabled Administrator, including concurrent requests and restore outcomes. Another Administrator can reset an account. First-run setup generates a high-entropy single-use admin recovery code, displayed once with a facility custody instruction; store only its verifier. The code resets an existing admin password and revokes sessions, then rotates itself. It is not a master password or manufacturer backdoor. Show generic failure/delay for invalid recovery attempts.

If all admin passwords and the recovery code are lost, offer documented recovery using an intact authorized native backup, or report that access cannot be recovered through the app. Never delete authentication tables to unlock. Security controls govern application access, not a hostile Windows administrator who can replace executable/database files; do not claim encryption or protection against unrestricted filesystem access.

## 7. Account storage, audit and transfers

Keep account, grant, recovery-verifier and security-audit tables in the main-process-owned SQLite database, with explicit versioned schema. Business mutations write an append-only audit event transactionally with action, target IDs, actor account ID, timestamp, result/reason and command ID. Never include passwords or complete before/after clinical payloads. Security events record account changes and authentication outcomes with minimum necessary fields; no productivity/completion analytics.

CSV/Excel/JSON Whole Database exports mean all business data, excluding local accounts, grants, authentication secrets, sessions, recovery verifiers and security audit. Declare exclusions in the manifest and UI. Catalogs also exclude all account data. Operational event actor IDs in logical exports are replaced with a non-identifying source marker and imported as historical provenance, not as local principals. This intentionally qualifies the previous lossless-export promise: business facts are retained, security identity is not transported.

Native `.tasksheet-backup` remains an exact SQLite snapshot and therefore contains account verifiers, permissions and security audit. Only a freshly reauthenticated Administrator may create/use one. Label it sensitive and authentication-bearing; it is not encrypted by default. Never expose verifier values through preview. A native backup's hashes are not a portable login token or plaintext password.

Normal restore on an initialized workstation preserves current accounts, grants, recovery verifier and local security audit. Build a candidate with incoming business data and current security tables; incoming security state must not overwrite current access policy. Preserve the receiving actor's restore audit event. Whole-database logical imports can never introduce accounts or promote a user. Remap foreign historical actor references to an external marker without violating business relations.

Disaster recovery on a genuinely fresh workstation from a native backup is a separate mode: before exposing data or activating it, verify an enabled Administrator password or valid recovery code against the isolated candidate's security tables. Then restore the account store, invalidate all sessions, require admin password change and rotate recovery material. If neither proof is available, do not activate protected data. Inspect candidate structure safely without executing input SQL/code. A backup without a supported authentication schema follows the explicit legacy bootstrap procedure, never an unversioned bypass.

## 8. Verification

Test role defaults and Editor grants at both UI and direct IPC layers for every resource/action, including hidden lifecycle paths, imports and print/export. Test stale sessions, forged role/account fields, last-admin concurrency, dirty locks/user switching, password reset/recovery, audit integrity, logical export exclusions and native restore preserving current policy. No login/role feature is considered complete on UI evidence alone.

Technical basis: the hashing baseline follows [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Default-deny and per-request permission enforcement follow [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Product-specific role defaults, session duration and restore policies above are TaskSheet design decisions, not claims of certification.
