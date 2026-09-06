import React, { useEffect, useState } from "react";
import type { Bed, Placement, Resident, Room, Shift } from "../../domain/entities.js";
import { StepDialog } from "../components/StepDialog.js";
import { ConfirmDiscardDialog } from "../components/ConfirmDiscardDialog.js";
import { SaveErrorDialog } from "../components/SaveErrorDialog.js";
import { useDirtyGuard } from "../components/useDirtyGuard.js";
import { describeUseCaseError } from "../errorMessage.js";
import { unwrapQuery } from "../ipcHelpers.js";
import { useAuth } from "../auth/AuthContext.js";
import { effectiveCapabilities } from "../../domain/accounts.js";
import { nextOccurrencePreviews } from "../../domain/schedule.js";
import { parseHHmm, toLocalDate } from "../../domain/types.js";

interface RoomsAndBedsPanelProps {
  rooms: readonly Room[];
  beds: readonly Bed[];
  onChanged: () => void;
  canCreateRoom: boolean;
  canCreateBed: boolean;
}

function RoomsAndBedsPanel({ rooms, beds, onChanged, canCreateRoom, canCreateBed }: RoomsAndBedsPanelProps): React.JSX.Element {
  const [roomLabel, setRoomLabel] = useState("");
  const [bedRoomId, setBedRoomId] = useState("");
  const [bedLabel, setBedLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await window.tasksheet.rooms.create({ label: roomLabel });
    if (result.kind === "success") {
      setRoomLabel("");
      onChanged();
    } else {
      setError(describeUseCaseError(result));
    }
  }

  async function addBed(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await window.tasksheet.beds.create({ roomId: bedRoomId, label: bedLabel });
    if (result.kind === "success") {
      setBedLabel("");
      onChanged();
    } else {
      setError(describeUseCaseError(result));
    }
  }

  return (
    <div className="panel">
      <h2>Rooms &amp; Beds</h2>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {(canCreateRoom || canCreateBed) && (
        <div className="toolbar" style={{ alignItems: "flex-end" }}>
          {canCreateRoom && (
            <form onSubmit={addRoom} className="toolbar" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="room-label">Room label</label>
                <input id="room-label" required placeholder="101" value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} />
              </div>
              <button className="btn" type="submit">
                Add room
              </button>
            </form>
          )}
          {canCreateBed && (
            <form onSubmit={addBed} className="toolbar" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="bed-room">Room</label>
                <select id="bed-room" required value={bedRoomId} onChange={(e) => setBedRoomId(e.target.value)}>
                  <option value="">Select a room…</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="bed-label">Bed label</label>
                <input id="bed-label" required placeholder="A" value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={!bedRoomId}>
                Add bed
              </button>
            </form>
          )}
        </div>
      )}
      <p className="field-hint">{beds.length} bed(s) across {rooms.length} room(s).</p>
    </div>
  );
}

const EMPTY_RESIDENT_FORM = { firstName: "", lastName: "", bedId: "", startDate: new Date().toISOString().slice(0, 10) };

const RESIDENT_STEPS = ["Identity", "Placement & Status", "Review"] as const;

function AddResidentDialog({
  beds,
  rooms,
  occupiedBedIds,
  onClose,
  onCreated
}: {
  beds: readonly Bed[];
  rooms: readonly Room[];
  occupiedBedIds: ReadonlySet<string>;
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [form, setForm] = useState(EMPTY_RESIDENT_FORM);
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_RESIDENT_FORM);
  const guard = useDirtyGuard(isDirty, onClose);

  const availableBeds = beds.filter((b) => !occupiedBedIds.has(b.id));

  function roomLabelFor(bedId: string): string {
    const bed = beds.find((b) => b.id === bedId);
    const room = rooms.find((r) => r.id === bed?.roomId);
    return room ? `${room.label} / ${bed?.label}` : (bed?.label ?? bedId);
  }

  const stepValid =
    step === 0
      ? form.firstName.trim() !== "" && form.lastName.trim() !== ""
      : step === 1
        ? form.bedId !== "" && form.startDate !== ""
        : true;

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    const residentResult = await window.tasksheet.residents.create({ firstName: form.firstName, lastName: form.lastName });
    if (residentResult.kind !== "success") {
      setSaving(false);
      setSaveError(describeUseCaseError(residentResult));
      return;
    }
    const placementResult = await window.tasksheet.placements.create({
      residentId: residentResult.value.id,
      bedId: form.bedId,
      startDate: form.startDate
    });
    setSaving(false);
    if (placementResult.kind !== "success") {
      setSaveError(`Resident created, but placement failed: ${describeUseCaseError(placementResult)}`);
      return;
    }
    onCreated();
    onClose();
  }

  function onNext() {
    if (!stepValid) return;
    if (step < RESIDENT_STEPS.length - 1) setStep(step + 1);
    else void onSave();
  }

  return (
    <>
      <StepDialog
        titleId="add-resident-title"
        title="Add resident"
        steps={RESIDENT_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onRequestClose={guard.requestClose}
        inert={guard.confirmOpen || Boolean(saveError)}
        onBack={() => setStep(Math.max(0, step - 1))}
        onNext={onNext}
        isLastStep={step === RESIDENT_STEPS.length - 1}
        submitting={saving}
        submitLabel="Add resident"
      >
        {step === 0 && (
          <>
            <div className="field">
              <label htmlFor="resident-first-name">First name</label>
              <input
                id="resident-first-name"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="resident-last-name">Last name</label>
              <input
                id="resident-last-name"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="field">
              <label htmlFor="resident-bed">Bed</label>
              <select id="resident-bed" required value={form.bedId} onChange={(e) => setForm({ ...form, bedId: e.target.value })}>
                <option value="">Select an available bed…</option>
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {roomLabelFor(b.id)}
                  </option>
                ))}
              </select>
              {availableBeds.length === 0 && <span className="field-hint">No available beds — add a room/bed first.</span>}
            </div>
            <div className="field">
              <label htmlFor="resident-start-date">Placement start date</label>
              <input
                id="resident-start-date"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
          </>
        )}
        {step === 2 && (
          <div>
            <dl>
              <dt style={{ fontWeight: 600 }}>Name</dt>
              <dd>
                {form.firstName} {form.lastName}{" "}
                <button type="button" className="btn" onClick={() => setStep(0)}>
                  Edit
                </button>
              </dd>
              <dt style={{ fontWeight: 600, marginTop: 8 }}>Placement</dt>
              <dd>
                {form.bedId ? roomLabelFor(form.bedId) : "(none selected)"} starting {form.startDate}{" "}
                <button type="button" className="btn" onClick={() => setStep(1)}>
                  Edit
                </button>
              </dd>
            </dl>
          </div>
        )}
      </StepDialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </>
  );
}

const EMPTY_TASK_FORM = {
  taskName: "",
  role: "HCA" as "HCA" | "LPN",
  eligibleShiftIds: [] as string[],
  time: "0900",
  importantInformation: "",
  activeFrom: new Date().toISOString().slice(0, 10)
};

const TASK_STEPS = ["Task & Resident", "Schedule & Assignment", "Instructions & Visibility", "Review"] as const;

function AddTaskDialog({
  resident,
  shifts,
  onClose,
  onCreated
}: {
  resident: Resident;
  shifts: readonly Shift[];
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [form, setForm] = useState(EMPTY_TASK_FORM);
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_TASK_FORM);
  const guard = useDirtyGuard(isDirty, onClose);
  const roleShifts = shifts.filter((s) => s.role === form.role);

  function toggleShift(id: string) {
    setForm((f) => ({
      ...f,
      eligibleShiftIds: f.eligibleShiftIds.includes(id) ? f.eligibleShiftIds.filter((x) => x !== id) : [...f.eligibleShiftIds, id]
    }));
  }

  const stepValid =
    step === 0
      ? form.taskName.trim() !== ""
      : step === 1
        ? form.eligibleShiftIds.length > 0 && /^([01]\d|2[0-3])[0-5]\d$/.test(form.time)
        : true;

  const nextOccurrences = (() => {
    try {
      return nextOccurrencePreviews(
        { cadence: { kind: "daily" }, placement: { kind: "times", minutes: [parseHHmm(form.time)] } },
        toLocalDate(form.activeFrom),
        7
      );
    } catch {
      return [];
    }
  })();

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    const result = await window.tasksheet.residentTasks.create({
      residentId: resident.id,
      role: form.role,
      eligibleShiftIds: form.eligibleShiftIds,
      taskName: form.taskName,
      importantInformation: form.importantInformation || null,
      cadence: { kind: "daily" },
      placement: { kind: "times", times: [form.time] },
      activeFrom: form.activeFrom
    });
    setSaving(false);
    if (result.kind === "success") {
      onCreated();
      onClose();
    } else {
      setSaveError(describeUseCaseError(result));
    }
  }

  function onNext() {
    if (!stepValid) return;
    if (step < TASK_STEPS.length - 1) setStep(step + 1);
    else void onSave();
  }

  return (
    <>
      <StepDialog
        titleId="add-task-title"
        title={`Add care task for ${resident.firstName} ${resident.lastName}`}
        steps={TASK_STEPS}
        currentStep={step}
        onStepChange={setStep}
        onRequestClose={guard.requestClose}
        inert={guard.confirmOpen || Boolean(saveError)}
        onBack={() => setStep(Math.max(0, step - 1))}
        onNext={onNext}
        isLastStep={step === TASK_STEPS.length - 1}
        submitting={saving}
        submitLabel="Add task"
      >
        {step === 0 && (
          <>
            <p className="field-hint">Resident: {resident.firstName} {resident.lastName}</p>
            <div className="field">
              <label htmlFor="task-name">Task name</label>
              <input id="task-name" required value={form.taskName} onChange={(e) => setForm({ ...form, taskName: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="task-role">Role</label>
              <select
                id="task-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "HCA" | "LPN", eligibleShiftIds: [] })}
              >
                <option value="HCA">HCA</option>
                <option value="LPN">LPN</option>
              </select>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="field">
              <label>Eligible shifts</label>
              {roleShifts.length === 0 && <span className="field-hint">No {form.role} shifts configured yet.</span>}
              {roleShifts.map((s) => (
                <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                  <input type="checkbox" checked={form.eligibleShiftIds.includes(s.id)} onChange={() => toggleShift(s.id)} />
                  {s.name} ({s.shortCode})
                </label>
              ))}
            </div>
            <div className="field">
              <label htmlFor="task-time">Due time (HHmm)</label>
              <input id="task-time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="field">
              <label htmlFor="task-active-from">Active from</label>
              <input
                id="task-active-from"
                type="date"
                required
                value={form.activeFrom}
                onChange={(e) => setForm({ ...form, activeFrom: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="task-info">Important information (optional)</label>
              <textarea
                id="task-info"
                value={form.importantInformation}
                onChange={(e) => setForm({ ...form, importantInformation: e.target.value })}
              />
            </div>
          </>
        )}
        {step === 3 && (
          <div>
            <dl>
              <dt style={{ fontWeight: 600 }}>Task</dt>
              <dd>
                {form.taskName} ({form.role}){" "}
                <button type="button" className="btn" onClick={() => setStep(0)}>
                  Edit
                </button>
              </dd>
              <dt style={{ fontWeight: 600, marginTop: 8 }}>Schedule &amp; assignment</dt>
              <dd>
                Daily at {form.time}, shifts:{" "}
                {form.eligibleShiftIds.map((id) => shifts.find((s) => s.id === id)?.shortCode).join(", ") || "(none)"}{" "}
                <button type="button" className="btn" onClick={() => setStep(1)}>
                  Edit
                </button>
              </dd>
              <dt style={{ fontWeight: 600, marginTop: 8 }}>Instructions</dt>
              <dd>
                Active from {form.activeFrom}. {form.importantInformation || "(no important information)"}{" "}
                <button type="button" className="btn" onClick={() => setStep(2)}>
                  Edit
                </button>
              </dd>
            </dl>
            <h3 style={{ fontSize: 14 }}>Next occurrences</h3>
            {nextOccurrences.length === 0 && <p className="field-hint">No upcoming occurrences with the current schedule.</p>}
            <ul>
              {nextOccurrences.map((o) => (
                <li key={o.date}>
                  {o.date} — {o.labels.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </StepDialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </>
  );
}

export function ResidentsPage(): React.JSX.Element {
  const [residents, setResidents] = useState<readonly Resident[] | null>(null);
  const [placements, setPlacements] = useState<readonly Placement[]>([]);
  const [rooms, setRooms] = useState<readonly Room[]>([]);
  const [beds, setBeds] = useState<readonly Bed[]>([]);
  const [shifts, setShifts] = useState<readonly Shift[]>([]);
  const [search, setSearch] = useState("");
  const [addResidentOpen, setAddResidentOpen] = useState(false);
  const [taskDialogResident, setTaskDialogResident] = useState<Resident | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const { session, refresh } = useAuth();
  const capabilities = effectiveCapabilities(session.role, session.grants);
  const canCreateResident = capabilities.has("resident.create");
  const canCreateRoom = capabilities.has("room.create");
  const canCreateBed = capabilities.has("bed.create");
  const canCreateTask = capabilities.has("residentTask.create");

  function reloadAll() {
    window.tasksheet.residents.list().then((r) => {
      const value = unwrapQuery(r, refresh, setError);
      if (value) setResidents(value);
    });
    window.tasksheet.placements.list().then((r) => {
      const value = unwrapQuery(r, refresh, setError);
      if (value) setPlacements(value);
    });
    window.tasksheet.rooms.list().then((r) => {
      const value = unwrapQuery(r, refresh, setError);
      if (value) setRooms(value);
    });
    window.tasksheet.beds.list().then((r) => {
      const value = unwrapQuery(r, refresh, setError);
      if (value) setBeds(value);
    });
    window.tasksheet.shifts.list().then((r) => {
      const value = unwrapQuery(r, refresh, setError);
      if (value) setShifts(value);
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reloadAll, []);

  useEffect(() => {
    if (!residents) return;
    Promise.all(
      residents.map(async (r) => {
        const result = await window.tasksheet.residentTasks.listForResident(r.id);
        return [r.id, result.kind === "success" ? result.value.length : 0] as const;
      })
    ).then((entries) => setTaskCounts(Object.fromEntries(entries)));
  }, [residents]);

  const occupiedBedIds = new Set(placements.map((p) => p.bedId));

  // Smart search starts empty (no auto-filtering to "show everyone" as a
  // stand-in for selection) and never pre-selects a resident.
  const filtered =
    residents === null
      ? null
      : search.trim() === ""
        ? residents
        : residents.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.trim().toLowerCase()));

  function roomBedLabelFor(residentId: string): string {
    const placement = placements.find((p) => p.residentId === residentId);
    if (!placement) return "Unplaced";
    const bed = beds.find((b) => b.id === placement.bedId);
    const room = rooms.find((r) => r.id === bed?.roomId);
    return room && bed ? `${room.label} / ${bed.label}` : "Unplaced";
  }

  return (
    <>
      <RoomsAndBedsPanel rooms={rooms} beds={beds} onChanged={reloadAll} canCreateRoom={canCreateRoom} canCreateBed={canCreateBed} />

      <div className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Residents</h2>
          {canCreateResident && (
            <button className="btn btn--primary" onClick={() => setAddResidentOpen(true)} disabled={beds.length === 0}>
              Add resident
            </button>
          )}
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="resident-search">Search residents</label>
          <input
            id="resident-search"
            placeholder="Start typing a name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {beds.length === 0 && <p className="field-hint">Add a room and bed above before adding a resident.</p>}

        {filtered === null && <p role="status">Loading…</p>}
        {filtered !== null && filtered.length === 0 && search.trim() !== "" && (
          <div className="empty-state">No residents match “{search}”.</div>
        )}
        {filtered !== null && filtered.length === 0 && search.trim() === "" && residents?.length === 0 && (
          <div className="empty-state">No residents yet. Add one to begin scheduling care tasks.</div>
        )}
        {filtered !== null && filtered.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Room / Bed</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.firstName} {r.lastName}
                  </td>
                  <td>{roomBedLabelFor(r.id)}</td>
                  <td>{r.status}</td>
                  <td>{taskCounts[r.id] ?? "…"}</td>
                  <td>
                    {canCreateTask && (
                      <button className="btn" onClick={() => setTaskDialogResident(r)}>
                        Add task
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addResidentOpen && (
        <AddResidentDialog
          beds={beds}
          rooms={rooms}
          occupiedBedIds={occupiedBedIds}
          onClose={() => setAddResidentOpen(false)}
          onCreated={reloadAll}
        />
      )}
      {taskDialogResident && (
        <AddTaskDialog
          resident={taskDialogResident}
          shifts={shifts}
          onClose={() => setTaskDialogResident(null)}
          onCreated={reloadAll}
        />
      )}
    </>
  );
}
