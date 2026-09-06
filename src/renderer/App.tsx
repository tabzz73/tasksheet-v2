import React, { useEffect, useRef, useState } from "react";
import { DashboardPage } from "./pages/DashboardPage.js";
import { ShiftsPage } from "./pages/ShiftsPage.js";
import { ResidentsPage } from "./pages/ResidentsPage.js";
import { FyiBinderPage } from "./pages/FyiBinderPage.js";
import { PrintCenterPage } from "./pages/PrintCenterPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { CreateAdminPage } from "./auth/CreateAdminPage.js";
import { LoginPage } from "./auth/LoginPage.js";
import { ForcedPasswordChangePage } from "./auth/ForcedPasswordChangePage.js";
import { ChangePasswordDialog } from "./auth/ChangePasswordDialog.js";
import { AuthProvider } from "./auth/AuthContext.js";
import { ConfirmDiscardDialog } from "./components/ConfirmDiscardDialog.js";
import { isAnyDirty, clearAllDirty } from "./dirtyRegistry.js";
import type { SessionSummary } from "../application/useCases/auth.js";

const ROUTES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "shifts", label: "Shifts" },
  { id: "residents", label: "Residents" },
  { id: "fyi", label: "FYI Binder" },
  { id: "print", label: "Print Center" },
  { id: "settings", label: "Settings" }
] as const;

type RouteId = (typeof ROUTES)[number]["id"];
type PendingNav =
  | { kind: "route"; route: RouteId }
  | { kind: "logout" }
  | { kind: "close"; resolve: (proceed: boolean) => void };

/** Whether the app has established which top-level screen to boot into. Deliberately
 * separate from `session`/`locked` below: a lock (idle timeout, OS suspend, or the
 * user's own Lock button) must never unmount the app shell, or the in-memory draft
 * it holds is destroyed — ACCESS-CONTROL.md §5 requires the same account to be able
 * to recover that draft on reauthentication, not lose it. Only a genuine sign-out
 * (logout, a different account, or a revoked session) tears the shell down, since
 * that is exactly the boundary across which drafts must NOT leak. */
type BootPhase = "loading" | "needs-bootstrap" | "ready";

const SESSION_POLL_MS = 15_000;

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<RouteId>("dashboard");
  const [bootPhase, setBootPhase] = useState<BootPhase>("loading");
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockedAlias, setLockedAlias] = useState<string | undefined>(undefined);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // `inert` isn't in @types/react 18's HTMLAttributes yet, so it's set as a
  // real DOM property here rather than a JSX prop — it still does its job of
  // removing the underlying shell from focus/interaction/AT while locked,
  // without unmounting it (which would destroy the in-memory draft).
  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = locked;
  }, [locked]);

  function applyStatus(status: Awaited<ReturnType<typeof window.tasksheet.auth.sessionStatus>>) {
    if (status.status === "active") {
      setSession(status.session);
      setLocked(false);
      setLockedAlias(undefined);
    } else if (status.status === "locked") {
      setLocked(true);
      setLockedAlias(status.alias);
      // Deliberately do NOT clear `session` here — the app shell (and its
      // in-memory drafts) must stay mounted under the lock overlay so the
      // same account can recover them on reauthentication.
    } else {
      // No session at all: genuine sign-out or a revoked session. This account
      // boundary is exactly where drafts must NOT survive, so the shell unmounts.
      setSession(null);
      setLocked(false);
      setLockedAlias(undefined);
    }
  }

  async function refreshAuth() {
    const needsBootstrap = await window.tasksheet.auth.needsBootstrap();
    if (needsBootstrap) {
      setBootPhase("needs-bootstrap");
      setSession(null);
      setLocked(false);
      return;
    }
    setBootPhase("ready");
    applyStatus(await window.tasksheet.auth.sessionStatus());
  }

  useEffect(() => {
    void refreshAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detects locks the renderer didn't itself initiate — the idle-timeout sweep
  // and OS lock/suspend both lock the session in the main process without any
  // renderer action, and a revoked session (disabled account, password change
  // elsewhere) likewise changes state out from under this window.
  useEffect(() => {
    if (bootPhase !== "ready") return;
    const id = setInterval(() => {
      void window.tasksheet.auth.sessionStatus().then(applyStatus);
    }, SESSION_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootPhase]);

  // Main-process 'close' asks the renderer whether it's dirty before
  // actually closing the window (see electron/main.ts) — this is that
  // question, answered from the same registry the in-app nav guard below
  // uses. Discard-and-close reuses the identical centered confirmation.
  useEffect(() => {
    window.__tasksheetConfirmClose = () =>
      new Promise<boolean>((resolve) => {
        if (!isAnyDirty()) {
          resolve(true);
          return;
        }
        setPendingNav({ kind: "close", resolve });
      });
    return () => {
      window.__tasksheetConfirmClose = undefined;
    };
  }, []);

  if (bootPhase === "loading") {
    return <p role="status">Loading…</p>;
  }
  if (bootPhase === "needs-bootstrap") {
    return <CreateAdminPage onDone={() => void refreshAuth()} />;
  }
  if (!session) {
    // Genuinely signed out, or locked with nothing cached yet (e.g. the renderer
    // reloaded while the main-process session was already locked) — there is no
    // shell/draft to preserve, so the plain full-page login/unlock form is fine.
    return <LoginPage lockedAlias={locked ? lockedAlias : undefined} onSignedIn={() => void refreshAuth()} />;
  }
  if (session.mustChangePassword) {
    return <ForcedPasswordChangePage alias={session.alias} onChanged={() => void refreshAuth()} />;
  }

  async function doLogout() {
    await window.tasksheet.auth.logout();
    await refreshAuth();
  }

  function requestRoute(next: RouteId) {
    if (next === route) return;
    if (isAnyDirty()) setPendingNav({ kind: "route", route: next });
    else setRoute(next);
  }
  function requestLock() {
    // Locking never destroys work — it is recoverable by the same account,
    // exactly like an involuntary idle-timeout or OS-suspend lock — so this
    // never goes through the discard-confirmation gate.
    void window.tasksheet.auth.lock().then(() => refreshAuth());
  }
  function requestLogout() {
    if (isAnyDirty()) setPendingNav({ kind: "logout" });
    else void doLogout();
  }

  function onDiscardPendingNav() {
    if (!pendingNav) return;
    clearAllDirty();
    switch (pendingNav.kind) {
      case "route":
        setRoute(pendingNav.route);
        break;
      case "logout":
        void doLogout();
        break;
      case "close":
        pendingNav.resolve(true);
        break;
    }
    setPendingNav(null);
  }

  function onKeepEditingPendingNav() {
    if (pendingNav?.kind === "close") pendingNav.resolve(false);
    setPendingNav(null);
  }

  return (
    <AuthProvider value={{ session, refresh: () => void refreshAuth(), logout: requestLogout, lock: requestLock }}>
      <div className="app-shell" ref={shellRef} aria-hidden={locked || undefined}>
        <nav className="app-nav" aria-label="Primary">
          <div className="app-nav__brand">TaskSheet</div>
          <ul className="app-nav__list">
            {ROUTES.map((r) => (
              <li key={r.id}>
                <button
                  className="app-nav__link"
                  aria-current={route === r.id ? "page" : undefined}
                  onClick={() => requestRoute(r.id)}
                >
                  <span className="nav-label">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <header className="app-header">
          <h1>{ROUTES.find((r) => r.id === route)?.label}</h1>
          <div className="toolbar">
            <span className="field-hint">
              {session.alias} · {session.role}
            </span>
            <button className="btn" onClick={() => setChangePasswordOpen(true)}>
              Change password
            </button>
            <button className="btn" onClick={requestLock}>
              Lock
            </button>
            <button className="btn" onClick={requestLogout}>
              Logout
            </button>
          </div>
        </header>
        <main className="app-main">
          {route === "dashboard" && <DashboardPage />}
          {route === "shifts" && <ShiftsPage />}
          {route === "residents" && <ResidentsPage />}
          {route === "fyi" && <FyiBinderPage />}
          {route === "print" && <PrintCenterPage />}
          {route === "settings" && <SettingsPage />}
        </main>
      </div>
      {!locked && changePasswordOpen && <ChangePasswordDialog onClose={() => setChangePasswordOpen(false)} />}
      {!locked && pendingNav && <ConfirmDiscardDialog onKeepEditing={onKeepEditingPendingNav} onDiscard={onDiscardPendingNav} />}
      {locked && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <LoginPage lockedAlias={session.alias} onSignedIn={() => void refreshAuth()} />
        </div>
      )}
    </AuthProvider>
  );
}

declare global {
  interface Window {
    __tasksheetConfirmClose?: () => Promise<boolean>;
  }
}
