# TaskSheet V2 — Phase 1 Acceptance Matrix

Status as of this pass (continuing from commit `cf188b1`). Scope: close the
Phase 1 software gaps identified against `cf188b1` — real Electron IPC
boundary tests, shared dirty-exit/error protections on the remaining forms,
the configurable inactivity timeout with same-user draft recovery, verified
own/forced password change and fresh-reauthentication, rendered multi-page
print verification, and the database-path migration risk — **without**
claiming full release readiness and **without** pulling AC-50/51
(backup/restore, Phase 6) or DST precision (AC-08, Phase 2) into this pass.

Evidence commands, run in this session, referenced below:
- `npx vitest run` — 104 tests, all passing.
- `npm run lint` — `eslint . --max-warnings=0`, clean.
- `npx tsc --noEmit -p tsconfig.json` and `-p electron/tsconfig.json` — clean.
- `xvfb-run -a npm run test:electron` — 24/24 real Electron IPC boundary
  assertions passing, against the actual built `dist-electron/main.cjs` /
  `preload.cjs` through the real `contextBridge`/`ipcMain.handle` path.
- `xvfb-run -a npm run test:print` — 13/13 rendered-PDF assertions passing,
  via `webContents.printToPDF()` against the real Print Center UI, parsed
  with `pdf-parse`.

## Phase 1 acceptance criteria

| AC | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| AC-01 | Clean profile, no demo selected; complete setup | Met (carried from `cf188b1`, unchanged) | `tests/persistence/roundtrip.test.ts` |
| AC-02 | One bed/resident/shift/task; generate exactly one eligible row | Met (carried) | `tests/domain/generation.test.ts` |
| AC-03 | Equivalent LPN assignment; shared content snapshot | Met (carried) | `tests/domain/generation.test.ts`, `tests/component/assignmentSheet.test.tsx` |
| AC-04 | Restart persistence | Met (carried) | `tests/persistence/roundtrip.test.ts` |
| AC-05 | Long content spans pages; no clipping; headers/footer repeat | **Met — now verified against a real rendered PDF, not just static CSS.** `cf188b1`'s print tests asserted CSS text only (`page-break-inside: avoid` appears in the stylesheet source, `text-overflow: ellipsis` absent from it) — that proves the rule is *written*, not that Chromium *applies* it across an actual page break. This pass adds `tests/electron/printVerification.mjs`, which seeds 50 real rows (one with a ~350-character instruction and an ~85-character surname) through the real IPC path, drives the real Print Center UI, and calls `webContents.printToPDF()` — the same pipeline a physical print job uses. `pdf-parse` (which resolves Chromium's embedded/subset font glyph IDs back to Unicode via the PDF's own ToUnicode CMaps) confirms: the real PDF is 4 pages; the full 6-column header text is present on all 4; the long instruction and long surname survive intact with no `…`; the guide notice appears once, whole, on a single page (not split across a break); and screen chrome (nav/header) is absent from the printed output. **Fix applied**: `.print-sheet__notice` had no `page-break-inside: avoid`, so on a page-boundary-adjacent case it could have been cut in half — added, and the "not split" assertion now covers it. | `xvfb-run -a npm run test:print` — 13/13 passing |
| AC-44 | No default credentials; bootstrap-only; restart requires login | Met (carried) | `tests/application/auth.test.ts`; also exercised live through the real preload path in `tests/electron/ipcBoundary.mjs` |
| AC-45 | Role/capability defaults enforced in **main process**, not just hidden UI | **Met — now proven at the real IPC boundary, not only at the function-call boundary.** `cf188b1` tested `authorizedUseCases.ts` functions directly — proving the authorization *logic* is correct, but not that it is actually the code every `ipcMain.handle` registration calls, that Electron's real `event.sender.id` is what session binding keys off, or that the bundled preload's `contextBridge` surface can't be used to smuggle a forged identity. `tests/electron/ipcBoundary.mjs` now runs through the real built app: an unauthenticated sender is denied before any login; a second window that never logged in is denied even while another window in the same process is authenticated (sender binding, not process-wide); Viewer mutations are forbidden while Viewer reads/generates still succeed; Editor default vs. grantable capabilities are enforced exactly as ACCESS-CONTROL.md §2 specifies; and a captured *real* `ipcMain.handle` handler, invoked directly with a payload forging `accountId`/`role`/`authRevision`/`grants`, is still denied — proving authorization derives only from `event.sender.id`, never from renderer-supplied fields. | `xvfb-run -a npm run test:electron` — 24/24 passing |
| AC-46 | Editor without exact grant is denied; granting the exact capability enables only that operation | Met, now also proven at the real IPC boundary | Same `ipcBoundary.mjs` run; also `tests/application/authorizedUseCases.test.ts` |
| AC-47 | Last-admin protection, including forged actor/role payloads | Met (carried); forged-payload path additionally proven at the real IPC boundary this pass | `tests/application/auth.test.ts`; `ipcBoundary.mjs`'s forged-payload assertions |
| AC-48 | Argon2id hashing, lockout, reset/change, single-use recovery | **Met, with one correction from `cf188b1`'s report.** Argon2id is run at 19 MiB memory / 2 iterations / 1 parallelism via `hash-wasm` (`src/application/auth/passwordHashing.ts`). ACCESS-CONTROL.md's stated minimum is met exactly — the `cf188b1` report's claim that this "exceeds" the minimum was incorrect and is withdrawn; it meets it, not more. Also newly added and passing this pass: an explicit test proving admin password reset requires the **acting** admin's own current password (fresh reauthentication) — merely being logged in as an Administrator is not sufficient; `cf188b1` had only tested the success path, which does not by itself prove reauthentication is enforced. Own-password-change and forced-password-change now also have UI (`ChangePasswordDialog`, `ForcedPasswordChangePage`) — `cf188b1` had backend support only, no UI. | `tests/application/auth.test.ts` (18 tests, including the new reauthentication test); `tests/component/changePassword.test.tsx` (3 tests) |
| AC-49 | Idle/OS lock obscures data; same-user-only draft recovery; no cross-user cache; revoked/stale session denied | **Met — this pass closes a real architectural gap `cf188b1` had not addressed.** Previously, `phase.kind === "locked"` in `App.tsx` replaced the entire component tree with a bare login form, which unmounted every open editor and destroyed its in-memory draft — the opposite of "same-user draft recovery" (ACCESS-CONTROL.md §5). This pass restructures `App.tsx` so a lock (idle sweep, OS lock/suspend via `powerMonitor`, or the user's own Lock button) never unmounts the shell: the app tree stays mounted (marked `inert` and `aria-hidden`) under a full-screen reauthentication overlay, and only a genuine account boundary — logout, a different account, or a server-side session revocation — clears state and unmounts. The renderer also now polls `sessionStatus()` every 15s so it notices a lock the main process initiated on its own (idle sweep, OS suspend) without any renderer action. The Administrator-configurable timeout itself (5–60 min, default 10, persisted on `facility_settings.inactivity_lock_minutes`, migration v3) is read fresh on every 30s sweep in `electron/main.ts`, so a change takes effect without restart. New `SessionManager` unit tests cover `sweepIdleSessions` (locks only once idle ≥ timeout; `touch()` correctly postpones it; sessions are swept independently) and `lockAll` (locks every active session for OS lock/suspend; `unlock()` will not accept a different sender's key). New component tests prove: Lock does **not** raise the discard-confirmation dialog (it's recoverable, not destructive); the dirty Facility-settings draft is still present in the DOM under the lock overlay; unlocking with the same account's correct password restores it untouched; a wrong password is rejected and the draft stays locked and intact; and — the cross-user isolation half — **logout** (a genuine account boundary) does clear the draft, unlike a lock. | `tests/application/sessionManager.test.ts` (10 tests); `tests/component/lockRecovery.test.tsx` (3 tests); `xvfb-run -a npm run test:electron`'s revoked-session assertions (grant/role change invalidates an open session on its very next request, without waiting for logout) |
| AC-52 | Protected CRUD/bulk mutation recorded to an audit trail; audit itself not editable | **Partially met — gap identified, not in this pass's requested scope.** Account-administration actions (login/logout success/failure, password change/reset, lock/unlock, account create, role/grant change, recovery-code use) are recorded to `security_events` and there is no IPC channel that can mutate or delete that table (so "no audit editing" holds by construction for what is recorded). Ordinary business-record CRUD (resident/task/shift/room/bed create, shift deactivate, facility settings save) is **not yet** recorded as security/audit events — only account-and-session actions are. This is a real gap against the full AC-52 requirement; it was not one of the six items in this pass's instruction and has not been addressed here. |
| AC-53 | Viewer can print/save PDF; CSV export and shared-preset mutation denied; grant revocation invalidates in-flight results | **Partially met — the print half is verified; the export half depends on unbuilt Phase 5/6 work.** Viewer print/preview (view+print allowed to every role) is proven at the real IPC boundary (`ipcBoundary.mjs`: "Viewer can generate/preview an assignment document"). There is no CSV/data-export feature in the codebase yet (DATA-EXCHANGE.md is explicitly a later-phase scope), so "Viewer cannot CSV-export" cannot be verified — there is nothing to attempt. Grant-revocation invalidating an in-flight capability is proven for the mutation case in `ipcBoundary.mjs` ("after the grant is revoked, the same capability is denied again on the next request"); this has not been separately checked against an in-flight *preview* specifically. |

## Explicitly out of scope for this pass (per user instruction)

| Item | Disposition |
|------|-------------|
| AC-50, AC-51 (backup/restore, native/logical, disaster recovery) | Assigned to Phase 6. Not implemented, not tested, not claimed. |
| AC-08 (DST-precision recurrence) | Assigned to Phase 2. Not implemented, not tested, not claimed. |
| Windows packaging / physical printer output | Pending — this environment is Linux/Electron-under-Xvfb; no Windows installer or physical printer is available here. `printToPDF()` proves the same Chromium rendering/pagination pipeline a physical print job uses, but a physical print has not been performed. |

## Database path migration (item 6 of the instruction)

**Disposition: implemented in production code, not test-only, and covered by
persistence tests — not verified against an actual previously-shipped
build's real userData directory (no such physical/clean-machine
installation exists in this environment).**

`electron/main.ts`'s `app.whenReady()` now calls
`relocateLegacyStoreIfNeeded(legacyDbFilePath(), dbFilePath())` unconditionally,
every startup, before either file is opened:
- If the new ADR-0001 path (`userData/data/tasksheet.sqlite`) already has a
  store, nothing happens — never overwritten.
- If neither path has a store, nothing happens — a genuinely fresh install
  initializes normally at the new path.
- If only the pre-ADR-0001 path (`userData/tasksheet.sqlite3`, the path
  commit `a4966c0` actually used) has a store, it is **copied** (not moved)
  to the new path, along with its `-wal`/`-shm` sidecars if present, and the
  legacy file is left in place afterward as a recovery fallback. The copy is
  then opened and migrated forward through the normal migration chain.

This directly prevents the failure mode the instruction warned against:
silently initializing an empty database over an existing installation's
data. `tests/persistence/legacyPathRelocation.test.ts` covers all three
cases, including relocating a real schema-v1 (pre-accounts) database
produced by the same `createSqliteRepositories`/`openDatabase` code path
commit `a4966c0` used, confirming migration v2 (accounts/security tables)
then applies cleanly on top and prior business data survives intact. What
this does **not** cover: running the actual previously *installed*
`a4966c0`-era packaged app, then installing this build over it on a real
machine — that is a physical/clean-machine scenario this environment cannot
perform, consistent with the Windows/printer items above being marked
pending rather than claimed.

## Summary

Every item in the six-point instruction is closed with automated evidence
at the real production boundary (Electron IPC, rendered PDF output) rather
than only at the function-call or static-CSS level that `cf188b1`'s report
had relied on. Two corrections from that report are carried forward
explicitly rather than silently fixed: Argon2id at 19 MiB/2/1 **meets**
ACCESS-CONTROL.md's minimum, it does not exceed it; and the prior
authorization/print test coverage described here as gaps has now been
supplemented with, not replaced by, the new boundary-level tests. AC-50/51
and AC-08 remain correctly out of scope for Phase 1. AC-52 and AC-53 are
documented here as partially met with the specific gap named, since a
faithful acceptance matrix should not mark them fully met when they are
not — neither was part of this pass's requested scope, and closing them
fully depends on features (general business-event audit, CSV data export)
that belong to later phases per PRD.md/IMPLEMENTATION-PLAN.md.

**This is not a claim of full Phase 1 release readiness.** Windows
packaging and physical print certification remain pending as stated above,
and AC-52/AC-53 remain partially met as documented. Per the user's
instruction, work now proceeds to Phase 2 (domain breadth) on that basis.
