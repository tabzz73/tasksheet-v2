import React, { useEffect, useState } from "react";
import { DashboardPage } from "./pages/DashboardPage.js";
import { ShiftsPage } from "./pages/ShiftsPage.js";
import { ResidentsPage } from "./pages/ResidentsPage.js";
import { FyiBinderPage } from "./pages/FyiBinderPage.js";
import { PrintCenterPage } from "./pages/PrintCenterPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { CreateAdminPage } from "./auth/CreateAdminPage.js";
import { LoginPage } from "./auth/LoginPage.js";
import { AuthProvider } from "./auth/AuthContext.js";
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

type AuthPhase =
  | { kind: "loading" }
  | { kind: "needs-bootstrap" }
  | { kind: "signed-out" }
  | { kind: "locked"; alias: string }
  | { kind: "active"; session: SessionSummary };

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<RouteId>("dashboard");
  const [phase, setPhase] = useState<AuthPhase>({ kind: "loading" });

  async function refreshAuth() {
    const needsBootstrap = await window.tasksheet.auth.needsBootstrap();
    if (needsBootstrap) {
      setPhase({ kind: "needs-bootstrap" });
      return;
    }
    const status = await window.tasksheet.auth.sessionStatus();
    if (status.status === "active") setPhase({ kind: "active", session: status.session });
    else if (status.status === "locked") setPhase({ kind: "locked", alias: status.alias });
    else setPhase({ kind: "signed-out" });
  }

  useEffect(() => {
    void refreshAuth();
  }, []);

  if (phase.kind === "loading") {
    return <p role="status">Loading…</p>;
  }
  if (phase.kind === "needs-bootstrap") {
    return <CreateAdminPage onDone={() => void refreshAuth()} />;
  }
  if (phase.kind === "signed-out") {
    return <LoginPage onSignedIn={() => void refreshAuth()} />;
  }
  if (phase.kind === "locked") {
    return <LoginPage lockedAlias={phase.alias} onSignedIn={() => void refreshAuth()} />;
  }

  const { session } = phase;

  async function onLock() {
    await window.tasksheet.auth.lock();
    await refreshAuth();
  }
  async function onLogout() {
    await window.tasksheet.auth.logout();
    await refreshAuth();
  }

  return (
    <AuthProvider value={{ session, refresh: () => void refreshAuth(), logout: () => void onLogout(), lock: () => void onLock() }}>
      <div className="app-shell">
        <nav className="app-nav" aria-label="Primary">
          <div className="app-nav__brand">TaskSheet</div>
          <ul className="app-nav__list">
            {ROUTES.map((r) => (
              <li key={r.id}>
                <button
                  className="app-nav__link"
                  aria-current={route === r.id ? "page" : undefined}
                  onClick={() => setRoute(r.id)}
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
            <button className="btn" onClick={onLock}>
              Lock
            </button>
            <button className="btn" onClick={onLogout}>
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
    </AuthProvider>
  );
}
