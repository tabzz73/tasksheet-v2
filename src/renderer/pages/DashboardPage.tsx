import React from "react";

/**
 * Phase 1 scope covers facility -> shift -> resident -> task -> print only.
 * Dashboard widgets (current unit situation, away residents, follow-up,
 * Code of the Month — PRD.md §14) are phase 3. Showing a fabricated widget
 * here would misrepresent what is implemented; AC-11's empty state applies
 * once Customize exists to hide/show real widgets.
 */
export function DashboardPage(): React.JSX.Element {
  return (
    <div className="empty-state" role="status">
      <p>
        <strong>Dashboard widgets are not yet available.</strong>
      </p>
      <p>
        Operational visibility (unit situation, away residents, follow-up, Code of the Month) is planned for a later
        phase per IMPLEMENTATION-PLAN.md. Use Settings to configure the facility, Shifts to add a shift, Residents to
        add and place a resident and a task, then Print Center to generate and print an assignment sheet.
      </p>
    </div>
  );
}
