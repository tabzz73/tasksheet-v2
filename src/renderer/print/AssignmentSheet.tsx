import React from "react";
import type { AssignmentDocumentModel } from "../../domain/generation.js";

export interface AssignmentSheetProps {
  document: AssignmentDocumentModel;
}

/**
 * Renders the shared immutable AssignmentDocumentModel for both preview and
 * print (ARCHITECTURE-ESSENTIALS.md §3.3). Column set follows PRD.md §19.2
 * (LPN adds Vitals/Results) and §19.3 (HCA omits it and is denser).
 */
export function AssignmentSheet({ document }: AssignmentSheetProps): React.JSX.Element {
  const isLpn = document.kind === "lpn-assignment";
  const { facilityHeader, requestedContext } = document;

  return (
    <div className="print-sheet">
      <div className="print-sheet__header">
        <div>
          <strong>{facilityHeader.name}</strong>
          <div>{facilityHeader.addressLine1}</div>
          {facilityHeader.addressLine2 && <div>{facilityHeader.addressLine2}</div>}
          <div>
            {facilityHeader.mainPhone}
            {facilityHeader.nursingPhone ? ` · Nursing: ${facilityHeader.nursingPhone}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>
            <strong>
              {requestedContext.shiftShortCode} — {requestedContext.shiftName}
            </strong>
          </div>
          <div>Date: {requestedContext.date}</div>
          <div>Role: {requestedContext.role}</div>
          <div>Generated: {requestedContext.generatedAt}</div>
        </div>
      </div>

      {document.warnings.length > 0 && (
        <div className="banner-warning" style={{ marginBottom: 8 }}>
          {document.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th style={{ width: "4%" }}>☐</th>
            <th style={{ width: "8%" }}>Time</th>
            <th style={{ width: "9%" }}>Room</th>
            <th style={{ width: "18%" }}>Resident</th>
            <th style={{ width: isLpn ? "20%" : "22%" }}>Task</th>
            <th style={{ width: isLpn ? "22%" : "24%" }}>Important Information</th>
            {isLpn && <th style={{ width: "14%" }}>Vitals / Results</th>}
            <th style={{ width: isLpn ? "14%" : "15%" }}>{isLpn ? "Notes / Follow-up" : "Notes"}</th>
          </tr>
        </thead>
        <tbody>
          {document.rows.length === 0 && (
            <tr>
              <td colSpan={isLpn ? 8 : 7}>No due tasks for this date and shift.</td>
            </tr>
          )}
          {document.rows.map((row) => (
            <tr key={row.occurrenceKey}>
              <td></td>
              <td>{row.time ?? ""}</td>
              <td>{row.room}</td>
              <td>
                {row.residentFirstName} {row.residentLastName}
              </td>
              <td>{row.taskName}</td>
              <td>{row.importantInformation ?? ""}</td>
              {isLpn && <td></td>}
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-sheet__notice">{document.notice}</div>
    </div>
  );
}
