import React, { useEffect, useState } from "react";
import type { FacilitySettings } from "../../domain/entities.js";
import { describeUseCaseError } from "../errorMessage.js";
import { unwrapQuery } from "../ipcHelpers.js";
import { useAuth } from "../auth/AuthContext.js";
import { UsersAndAccessPanel } from "./UsersAndAccessPanel.js";
import { SaveErrorDialog } from "../components/SaveErrorDialog.js";
import { ConfirmDiscardDialog } from "../components/ConfirmDiscardDialog.js";
import { clearAllDirty, isAnyDirty, setDirty } from "../dirtyRegistry.js";

const COMMON_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu"
];

const EMPTY_FORM = {
  facilityId: "facility-1",
  name: "",
  addressLine1: "",
  addressLine2: "",
  mainPhone: "",
  nursingPhone: "",
  fax: "",
  timeZone: "America/Denver",
  weekStart: 1 as 1 | 7,
  escalationThreshold: 3,
  inactivityLockMinutes: 10
};

type FormState = typeof EMPTY_FORM;

function toForm(settings: FacilitySettings): FormState {
  return {
    facilityId: settings.facilityId,
    name: settings.name,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2 ?? "",
    mainPhone: settings.mainPhone,
    nursingPhone: settings.nursingPhone ?? "",
    fax: settings.fax ?? "",
    timeZone: settings.timeZone,
    weekStart: settings.weekStart,
    escalationThreshold: settings.escalationThreshold,
    inactivityLockMinutes: settings.inactivityLockMinutes
  };
}

function FacilityAndLocaleCategory(): React.JSX.Element {
  const { refresh } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    window.tasksheet.facility.get().then((result) => {
      const existing = unwrapQuery(result, refresh, setError);
      if (existing) {
        setForm(toForm(existing));
        setSaved(toForm(existing));
      }
      setStatus("idle");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  useEffect(() => {
    setDirty("settings-facility", isDirty);
    return () => setDirty("settings-facility", false);
  }, [isDirty]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setSaveError(null);
    setSavedMessage(false);
    const result = await window.tasksheet.facility.save({
      ...form,
      addressLine2: form.addressLine2 || null,
      nursingPhone: form.nursingPhone || null,
      fax: form.fax || null
    });
    setStatus("idle");
    if (result.kind === "success") {
      setSaved(form);
      setSavedMessage(true);
    } else if (result.kind === "unauthenticated") {
      refresh();
    } else {
      setSaveError(describeUseCaseError(result));
    }
  }

  if (status === "loading") {
    return <p role="status">Loading facility settings…</p>;
  }

  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <h2>Facility &amp; Locale</h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="facility-name">Facility name</label>
          <input
            id="facility-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="facility-address1">Address</label>
          <input
            id="facility-address1"
            required
            value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="facility-address2">Address line 2 (optional)</label>
          <input
            id="facility-address2"
            value={form.addressLine2}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="facility-phone">Main phone</label>
          <input
            id="facility-phone"
            required
            value={form.mainPhone}
            onChange={(e) => setForm({ ...form, mainPhone: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="facility-nursing-phone">Nursing/unit phone (optional)</label>
          <input
            id="facility-nursing-phone"
            value={form.nursingPhone}
            onChange={(e) => setForm({ ...form, nursingPhone: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="facility-timezone">Facility timezone</label>
          <select
            id="facility-timezone"
            value={form.timeZone}
            onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
          >
            {COMMON_TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <span className="field-hint">Overnight due-date and shift-window calculations use this timezone.</span>
        </div>
        <div className="field">
          <label htmlFor="facility-week-start">Week start</label>
          <select
            id="facility-week-start"
            value={form.weekStart}
            onChange={(e) => setForm({ ...form, weekStart: Number(e.target.value) as 1 | 7 })}
          >
            <option value={1}>Monday</option>
            <option value={7}>Sunday</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="facility-inactivity-lock">Inactivity lock (minutes)</label>
          <input
            id="facility-inactivity-lock"
            type="number"
            min={5}
            max={60}
            required
            value={form.inactivityLockMinutes}
            onChange={(e) => setForm({ ...form, inactivityLockMinutes: Number(e.target.value) })}
          />
          <span className="field-hint">5–60 minutes of inactivity before the session locks. Default 10.</span>
        </div>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {savedMessage && !isDirty && (
          <p role="status" className="field-hint">
            Saved.
          </p>
        )}

        <button className="btn btn--primary" type="submit" disabled={status === "saving" || !isDirty}>
          {status === "saving" ? "Saving…" : "Save facility settings"}
        </button>
      </form>
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </div>
  );
}

const CATEGORIES = [
  { id: "facility", label: "Facility & Locale" },
  { id: "access", label: "Users & Access" }
] as const;
type CategoryId = (typeof CATEGORIES)[number]["id"];

export function SettingsPage(): React.JSX.Element {
  const { session } = useAuth();
  const isAdmin = session.role === "Administrator";
  const [category, setCategory] = useState<CategoryId>("facility");
  const [pendingCategory, setPendingCategory] = useState<CategoryId | null>(null);

  const visibleCategories = CATEGORIES.filter((c) => c.id !== "access" || isAdmin);

  function requestCategoryChange(next: CategoryId) {
    if (next === category) return;
    if (isAnyDirty()) {
      setPendingCategory(next);
    } else {
      setCategory(next);
    }
  }

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <nav aria-label="Settings categories" style={{ minWidth: 180 }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {visibleCategories.map((c) => (
            <li key={c.id}>
              <button
                className="app-nav__link"
                aria-current={category === c.id ? "page" : undefined}
                onClick={() => requestCategoryChange(c.id)}
                style={{ background: category === c.id ? "var(--color-panel)" : "transparent" }}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div style={{ flex: 1 }}>
        {category === "facility" && <FacilityAndLocaleCategory />}
        {category === "access" && isAdmin && <UsersAndAccessPanel />}
      </div>
      {pendingCategory && (
        <ConfirmDiscardDialog
          onKeepEditing={() => setPendingCategory(null)}
          onDiscard={() => {
            clearAllDirty();
            setCategory(pendingCategory);
            setPendingCategory(null);
          }}
        />
      )}
    </div>
  );
}
