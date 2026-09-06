import React, { useState } from "react";
import { PASSWORD_MIN_LENGTH } from "../../domain/passwordPolicy.js";
import { describeUseCaseError } from "../errorMessage.js";
import { Dialog } from "../components/Dialog.js";
import { ConfirmDiscardDialog } from "../components/ConfirmDiscardDialog.js";
import { SaveErrorDialog } from "../components/SaveErrorDialog.js";
import { useDirtyGuard } from "../components/useDirtyGuard.js";

const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

/** Own-password change (ACCESS-CONTROL.md §5): requires the current password; distinct from an Administrator reset. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [form, setForm] = useState(EMPTY);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const guard = useDirtyGuard(isDirty, onClose);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setSaveError("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await window.tasksheet.auth.changeOwnPassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword
    });
    setSaving(false);
    if (result.kind === "success") {
      onClose();
    } else {
      setSaveError(describeUseCaseError(result));
    }
  }

  return (
    <>
      <Dialog
        titleId="change-password-title"
        title="Change password"
        onRequestClose={guard.requestClose}
        inert={guard.confirmOpen || Boolean(saveError)}
        footer={
          <button className="btn btn--primary" type="submit" form="change-password-form" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </button>
        }
      >
        <form id="change-password-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="change-current-password">Current password</label>
            <input
              id="change-current-password"
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="change-new-password">New password</label>
            <input
              id="change-new-password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="change-confirm-password">Confirm new password</label>
            <input
              id="change-confirm-password"
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </>
  );
}
