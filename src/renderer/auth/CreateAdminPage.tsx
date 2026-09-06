import React, { useState } from "react";
import { PASSWORD_MIN_LENGTH } from "../../domain/passwordPolicy.js";
import { describeUseCaseError } from "../errorMessage.js";

/**
 * First-run Administrator enrollment (ACCESS-CONTROL.md §5 / PRD.md §6.3):
 * no resident data is rendered before sign-in, there are no default
 * credentials, and the recovery code is displayed exactly once.
 */
export function CreateAdminPage({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [savedRecoveryCode, setSavedRecoveryCode] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await window.tasksheet.auth.bootstrapAdmin({ alias, password });
    setSaving(false);
    if (result.kind === "success") {
      setRecoveryCode(result.value.recoveryCode);
    } else {
      setError(describeUseCaseError(result));
    }
  }

  if (recoveryCode) {
    return (
      <div className="panel" style={{ maxWidth: 560, margin: "48px auto" }}>
        <h1>Save your recovery code</h1>
        <p>
          This single-use code resets the Administrator password if it is ever lost. It is shown only this once — write it
          down and keep it with your facility&apos;s secure records.
        </p>
        <pre
          style={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            padding: 16,
            fontSize: 18,
            textAlign: "center",
            letterSpacing: 1
          }}
        >
          {recoveryCode}
        </pre>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400, margin: "16px 0" }}>
          <input type="checkbox" checked={savedRecoveryCode} onChange={(e) => setSavedRecoveryCode(e.target.checked)} />
          I have saved this recovery code somewhere secure.
        </label>
        <button className="btn btn--primary" disabled={!savedRecoveryCode} onClick={onDone}>
          Continue to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 480, margin: "48px auto" }}>
      <h1>Create the first Administrator</h1>
      <p className="field-hint">No facility or resident data is available until an Administrator account is created.</p>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="bootstrap-alias">Login name</label>
          <input id="bootstrap-alias" required value={alias} onChange={(e) => setAlias(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="bootstrap-password">Password</label>
          <input
            id="bootstrap-password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="field-hint">At least {PASSWORD_MIN_LENGTH} characters. Spaces and password managers are fine.</span>
        </div>
        <div className="field">
          <label htmlFor="bootstrap-confirm">Confirm password</label>
          <input
            id="bootstrap-confirm"
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
          {saving ? "Creating…" : "Create Administrator"}
        </button>
      </form>
    </div>
  );
}
