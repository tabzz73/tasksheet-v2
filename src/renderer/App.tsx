import React, { useState } from "react";
import { DashboardPage } from "./pages/DashboardPage.js";
import { ShiftsPage } from "./pages/ShiftsPage.js";
import { ResidentsPage } from "./pages/ResidentsPage.js";
import { FyiBinderPage } from "./pages/FyiBinderPage.js";
import { PrintCenterPage } from "./pages/PrintCenterPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

const ROUTES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "shifts", label: "Shifts" },
  { id: "residents", label: "Residents" },
  { id: "fyi", label: "FYI Binder" },
  { id: "print", label: "Print Center" },
  { id: "settings", label: "Settings" }
] as const;

type RouteId = (typeof ROUTES)[number]["id"];

export function App(): React.JSX.Element {
  const [route, setRoute] = useState<RouteId>("settings");

  return (
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
  );
}
