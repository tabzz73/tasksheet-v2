import React, { useState } from "react";
import { PASSWORD_MIN_LENGTH } from "../../domain/passwordPolicy.js";
import { describeUseCaseError } from "../errorMessage.js";

/**
 * Shown instead of the app shell whenever the active session's
 * `mustChangePassword` flag is set (an Administrator reset it or a
 * recovery-code reset occurred) — ACCESS-CONTROL.md §5: "reset users must
 * change their password before normal data access." No nav, no data, and
 * no dismiss action: the only way out is a successful password change.
 */
export function ForcedPasswordChangePage({ alias, onChanged }: { alias: string; onChanged: () => void }): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await window.tasksheet.auth.changeOwnPassword({ currentPassword, newPassword });
    setSaving(false);
    if (result.kind === "success") {
      onChanged();
    } else {
      setError(describeUseCaseError(result));
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 440, margin: "72px auto" }}>
      <h1>Change your password</h1>
      <p className="field-hint">
        Signed in as {alias}. An Administrator reset this account&apos;s password — choose a new one before continuing.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="forced-current-password">Temporary password</label>
          <input
            id="forced-current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="forced-new-password">New password</label>
          <input
            id="forced-new-password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="forced-confirm-password">Confirm new password</label>
          <input
            id="forced-confirm-password"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
