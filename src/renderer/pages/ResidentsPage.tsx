import React, { useEffect, useState } from "react";
import type { Bed, Placement, Resident, Room, Shift } from "../../domain/entities.js";
import { Dialog } from "../components/Dialog.js";
import { ConfirmDiscardDialog } from "../components/ConfirmDiscardDialog.js";
import { useDirtyGuard } from "../components/useDirtyGuard.js";

interface RoomsAndBedsPanelProps {
  rooms: readonly Room[];
  beds: readonly Bed[];
  onChanged: () => void;
}

function RoomsAndBedsPanel({ rooms, beds, onChanged }: RoomsAndBedsPanelProps): React.JSX.Element {
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
      setError(result.message);
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
      setError(result.message);
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
      <div className="toolbar" style={{ alignItems: "flex-end" }}>
        <form onSubmit={addRoom} className="toolbar" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="room-label">Room label</label>
            <input id="room-label" required placeholder="101" value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} />
          </div>
          <button className="btn" type="submit">
            Add room
          </button>
        </form>
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
      </div>
      <p className="field-hint">{beds.length} bed(s) across {rooms.length} room(s).</p>
    </div>
  );
}

const EMPTY_RESIDENT_FORM = { firstName: "", lastName: "", bedId: "", startDate: new Date().toISOString().slice(0, 10) };

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_RESIDENT_FORM);
  const guard = useDirtyGuard(isDirty, onClose);

  const availableBeds = beds.filter((b) => !occupiedBedIds.has(b.id));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const residentResult = await window.tasksheet.residents.create({ firstName: form.firstName, lastName: form.lastName });
    if (residentResult.kind !== "success") {
      setSaving(false);
      setError(residentResult.message);
      return;
    }
    const placementResult = await window.tasksheet.placements.create({
      residentId: residentResult.value.id,
      bedId: form.bedId,
      startDate: form.startDate
    });
    setSaving(false);
    if (placementResult.kind !== "success") {
      setError(`Resident created, but placement failed: ${placementResult.message}`);
      return;
    }
    onCreated();
    onClose();
  }

  function roomLabelFor(bedId: string): string {
    const bed = beds.find((b) => b.id === bedId);
    const room = rooms.find((r) => r.id === bed?.roomId);
    return room ? `${room.label} / ${bed?.label}` : (bed?.label ?? bedId);
  }

  return (
    <>
      <Dialog titleId="add-resident-title" title="Add resident" onRequestClose={guard.requestClose} inert={guard.confirmOpen}>
        <form onSubmit={onSubmit} noValidate>
          <fieldset style={{ border: "none", padding: 0, marginBottom: 12 }}>
            <legend style={{ fontWeight: 700, fontSize: 13 }}>Identity</legend>
            <div className="field">
              <label htmlFor="resident-first-name">First name</label>
              <input
                id="resident-first-name"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
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
          </fieldset>
          <fieldset style={{ border: "none", padding: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: 13 }}>Placement</legend>
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
          </fieldset>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary" type="submit" disabled={saving || availableBeds.length === 0}>
            {saving ? "Saving…" : "Add resident"}
          </button>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
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
  const [error, setError] = useState<string | null>(null);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
      setError(result.message);
    }
  }

  return (
    <>
      <Dialog
        titleId="add-task-title"
        title={`Add care task for ${resident.firstName} ${resident.lastName}`}
        onRequestClose={guard.requestClose}
        inert={guard.confirmOpen}
      >
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="task-name">Task name</label>
            <input id="task-name" required value={form.taskName} onChange={(e) => setForm({ ...form, taskName: e.target.value })} />
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
          <div className="field">
            <label htmlFor="task-info">Important information (optional)</label>
            <textarea
              id="task-info"
              value={form.importantInformation}
              onChange={(e) => setForm({ ...form, importantInformation: e.target.value })}
            />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--primary" type="submit" disabled={saving || form.eligibleShiftIds.length === 0}>
            {saving ? "Saving…" : "Add task"}
          </button>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
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

  function reloadAll() {
    window.tasksheet.residents.list().then(setResidents);
    window.tasksheet.placements.list().then(setPlacements);
    window.tasksheet.rooms.list().then(setRooms);
    window.tasksheet.beds.list().then(setBeds);
    window.tasksheet.shifts.list().then(setShifts);
  }

  useEffect(reloadAll, []);

  useEffect(() => {
    if (!residents) return;
    Promise.all(
      residents.map(async (r) => [r.id, (await window.tasksheet.residentTasks.listForResident(r.id)).length] as const)
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
      <RoomsAndBedsPanel rooms={rooms} beds={beds} onChanged={reloadAll} />

      <div className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Residents</h2>
          <button className="btn btn--primary" onClick={() => setAddResidentOpen(true)} disabled={beds.length === 0}>
            Add resident
          </button>
        </div>

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
                    <button className="btn" onClick={() => setTaskDialogResident(r)}>
                      Add task
                    </button>
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
