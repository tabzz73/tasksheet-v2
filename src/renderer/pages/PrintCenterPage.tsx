import React, { useEffect, useState } from "react";
import type { Shift } from "../../domain/entities.js";
import type { AssignmentDocumentModel } from "../../domain/generation.js";
import { AssignmentSheet } from "../print/AssignmentSheet.js";
import { describeUseCaseError } from "../errorMessage.js";
import { unwrapQuery } from "../ipcHelpers.js";
import { useAuth } from "../auth/AuthContext.js";

export function PrintCenterPage(): React.JSX.Element {
  const { refresh } = useAuth();
  const [shifts, setShifts] = useState<readonly Shift[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shiftId, setShiftId] = useState("");
  const [document, setDocument] = useState<AssignmentDocumentModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    window.tasksheet.shifts.list().then((result) => {
      const list = unwrapQuery(result, refresh, setError);
      if (!list) return;
      setShifts(list);
      if (list.length > 0 && !shiftId) setShiftId(list[0]!.id);
    });
    // Quick Print's shift default is a configuration convenience only —
    // it never stands in for a chosen resident (PRD.md §11 applies to
    // resident selectors, not to this facility-wide shift picker).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setDocument(null);
    const result = await window.tasksheet.assignment.generate({ date, shiftId });
    setGenerating(false);
    if (result.kind === "success") {
      setDocument(result.value);
    } else if (result.kind === "unauthenticated") {
      refresh();
    } else {
      setError(describeUseCaseError(result));
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Quick Print — Generate assignment sheet</h2>
        <form onSubmit={onGenerate} className="toolbar" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="print-date">Date</label>
            <input id="print-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="print-shift">Shift</label>
            <select id="print-shift" required value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">Select a shift…</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortCode} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn--primary" type="submit" disabled={generating || !shiftId}>
            {generating ? "Generating…" : "Generate preview"}
          </button>
          {shifts.length === 0 && <span className="field-hint">Configure a shift under Shifts first.</span>}
        </form>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {document && (
        <div className="panel">
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Preview</h2>
            <button className="btn btn--primary" onClick={() => window.print()}>
              Print
            </button>
          </div>
          <div style={{ border: "1px solid var(--color-border)", padding: 16, marginTop: 12 }}>
            <AssignmentSheet document={document} />
          </div>
        </div>
      )}
    </>
  );
}
