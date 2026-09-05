import React, { useEffect, useState } from "react";
import type { FacilitySettings } from "../../domain/entities.js";

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
  escalationThreshold: 3
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
    escalationThreshold: settings.escalationThreshold
  };
}

export function SettingsPage(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    window.tasksheet.facility.get().then((existing) => {
      if (existing) {
        setForm(toForm(existing));
        setSaved(toForm(existing));
      }
      setStatus("idle");
    });
  }, []);

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
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
    } else {
      setError(result.message);
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
    </div>
  );
}
