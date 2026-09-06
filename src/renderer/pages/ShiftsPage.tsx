import React, { useEffect, useState } from "react";
import type { Shift } from "../../domain/entities.js";
import { formatHHmm } from "../../domain/types.js";
import { Dialog } from "../components/Dialog.js";
import { ConfirmDiscardDialog } from "../components/ConfirmDiscardDialog.js";
import { useDirtyGuard } from "../components/useDirtyGuard.js";
import { describeUseCaseError } from "../errorMessage.js";
import { unwrapQuery } from "../ipcHelpers.js";
import { useAuth } from "../auth/AuthContext.js";
import { effectiveCapabilities } from "../../domain/accounts.js";

const EMPTY = { shortCode: "", name: "", role: "HCA" as "HCA" | "LPN", startTime: "0700", endTime: "1500" };

function AddShiftDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const guard = useDirtyGuard(isDirty, onClose);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await window.tasksheet.shifts.create(form);
    setSaving(false);
    if (result.kind === "success") {
      onCreated();
      onClose();
    } else {
      setError(describeUseCaseError(result));
    }
  }

  return (
    <>
      <Dialog titleId="add-shift-title" title="Add shift" onRequestClose={guard.requestClose} inert={guard.confirmOpen}>
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="shift-short-code">Short code</label>
            <input
              id="shift-short-code"
              required
              placeholder="D1"
              value={form.shortCode}
              onChange={(e) => setForm({ ...form, shortCode: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="shift-name">Full name</label>
            <input
              id="shift-name"
              required
              placeholder="Day HCA"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="shift-role">Role</label>
            <select id="shift-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "HCA" | "LPN" })}>
              <option value="HCA">HCA</option>
              <option value="LPN">LPN</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="shift-start">Start time (HHmm)</label>
            <input
              id="shift-start"
              required
              placeholder="0700"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="shift-end">End time (HHmm)</label>
            <input
              id="shift-end"
              required
              placeholder="1500"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
            <span className="field-hint">An end time at or before the start time makes this an overnight shift.</span>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add shift"}
          </button>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
    </>
  );
}

export function ShiftsPage(): React.JSX.Element {
  const { session, refresh } = useAuth();
  const [shifts, setShifts] = useState<readonly Shift[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCreateShift = effectiveCapabilities(session.role, session.grants).has("shift.create");

  function reload() {
    window.tasksheet.shifts.list().then((result) => {
      const value = unwrapQuery(result, refresh, setError);
      if (value) setShifts(value);
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, []);

  return (
    <div className="panel">
      <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Shifts</h2>
        {canCreateShift && (
          <button className="btn btn--primary" onClick={() => setDialogOpen(true)}>
            Add shift
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {shifts === null && <p role="status">Loading…</p>}
      {shifts !== null && shifts.length === 0 && (
        <div className="empty-state">No shifts configured yet. Add one to start scheduling tasks.</div>
      )}
      {shifts !== null && shifts.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Role</th>
              <th>Start</th>
              <th>End</th>
              <th>Overnight</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td>{s.shortCode}</td>
                <td>{s.name}</td>
                <td>{s.role}</td>
                <td>{formatHHmm(s.startMinutes)}</td>
                <td>{formatHHmm(s.endMinutes)}</td>
                <td>{s.endMinutes <= s.startMinutes ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogOpen && <AddShiftDialog onClose={() => setDialogOpen(false)} onCreated={reload} />}
    </div>
  );
}
