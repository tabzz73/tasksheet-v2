import React, { useState } from "react";
import { describeUseCaseError } from "../errorMessage.js";

export function LoginPage({ onSignedIn, lockedAlias }: { onSignedIn: () => void; lockedAlias?: string }): React.JSX.Element {
  const [alias, setAlias] = useState(lockedAlias ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = lockedAlias
      ? await window.tasksheet.auth.unlock({ password })
      : await window.tasksheet.auth.login({ alias, password });
    setSaving(false);
    if (result.kind === "success") {
      onSignedIn();
    } else {
      setError(describeUseCaseError(result));
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 400, margin: "72px auto" }}>
      <h1>{lockedAlias ? "Session locked" : "Sign in"}</h1>
      {lockedAlias && <p className="field-hint">Signed in as {lockedAlias}. Enter your password to continue.</p>}
      <form onSubmit={onSubmit} noValidate>
        {!lockedAlias && (
          <div className="field">
            <label htmlFor="login-alias">Login name</label>
            <input id="login-alias" required value={alias} onChange={(e) => setAlias(e.target.value)} autoFocus />
          </div>
        )}
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={Boolean(lockedAlias)}
            />
            <button type="button" className="btn" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary" type="submit" disabled={saving}>
          {saving ? "Signing in…" : lockedAlias ? "Unlock" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
