# ADR-0002 — Local accounts and permission enforcement

Status: Adopted implementation baseline 4; requested by the user, implementation pending.
Date: 2026-09-05

## Context

The prior suite prohibited all staff identity and usernames while describing administrators/editors only as intended users. The user has now explicitly requested CRUD permissions and local Administrator, Editor and Viewer accounts. This requires a narrow change to the controlling PRD and dependent architecture, not a silent exception in agent instructions.

## Decision

Adopt ACCESS-CONTROL.md. Permit minimal application login names, account IDs, password verifiers, grants and security audit references. Continue excluding employee profiles, contact information, job credentials, payroll, staff scheduling and performance tracking. Access roles are independent from HCA/LPN/RN care roles.

Keep security tables in main-process-owned SQLite. Authorize every privileged request in the main-process application layer with a sender-bound session and current grants; UI capability checks improve usability only. Viewer is read/print-only for business data. Editor writes operational records and receives no deletion/import/export powers unless explicitly granted. Administrator manages accounts, full transfers and recovery with last-admin protection and reauthentication.

## Alternatives and consequences

- Hiding edit/delete buttons alone is insufficient and rejected.
- OS-only access offers no per-application Editor/Viewer roles and is rejected for the requested workflow.
- Cloud login is outside offline V2 scope.
- A separate employee/staff domain remains out of scope.

Credential-bearing native backups are admin-only and sensitive. Logical CSV/Excel/JSON exports intentionally exclude the security domain. Normal restore preserves current access policy; fresh-machine disaster recovery verifies an administrator against the protected backup before activation. This amends ADR-0001's former universal no-identity backup wording and narrows exact restoration to the explicitly authorized recovery mode.

## Migration and rollback

Migrate schema with pre-migration recovery evidence and owner-attended first-admin enrollment for recognized legacy databases. Never infer the first admin from a Windows username or ship default credentials. Add migration ledger entries, capability tests and security audit without retroactively inventing actors for historical events. A current database whose authentication tables vanish enters recovery rather than bootstrap. Reverting to an older unauthenticated app removes these protections; do not describe such a rollback as equivalent access control.

## Affected documents and gates

PRD, Architecture Essentials, Architecture, DATA-CONTRACTS, DATA-EXCHANGE, UI-UX-SPEC, AGENTS, CLAUDE, IMPLEMENTATION-PLAN, PROMPT, conflict history and ADR-0001 are synchronized. Phase 1 now includes first-admin setup/login and direct-IPC permission tests. Gate completion on ACCESS-CONTROL.md and the new acceptance scenarios; documentation adoption does not mean authentication has been implemented.
