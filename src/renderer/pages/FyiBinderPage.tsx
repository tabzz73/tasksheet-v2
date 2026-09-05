import React from "react";

/** FYI Binder (PRD.md §19.4) is scheduled for phase 3; kept as a real nav destination with an honest status rather than a dead link or fabricated content (IMPLEMENTATION-PLAN.md §2). */
export function FyiBinderPage(): React.JSX.Element {
  return (
    <div className="empty-state" role="status">
      <p>
        <strong>FYI Binder is not yet available.</strong>
      </p>
      <p>Standing facility/role/shift FYIs are planned for a later implementation phase.</p>
    </div>
  );
}
