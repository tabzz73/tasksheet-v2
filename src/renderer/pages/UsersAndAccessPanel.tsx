import React, { useEffect, useState } from "react";
import type { PublicAccount } from "../../application/useCases/auth.js";
import { GRANTABLE_EDITOR_CAPABILITIES, type AccessRole, type Capability } from "../../domain/accounts.js";
import { PASSWORD_MIN_LENGTH } from "../../domain/passwordPolicy.js";
import { describeUseCaseError } from "../errorMessage.js";
import { unwrapQuery } from "../ipcHelpers.js";
import { useAuth } from "../auth/AuthContext.js";
import { Dialog } from "../components/Dialog.js";
import { ConfirmDiscardDialog } from "../components/ConfirmDiscardDialog.js";
import { SaveErrorDialog } from "../components/SaveErrorDialog.js";
import { useDirtyGuard } from "../components/useDirtyGuard.js";

const EMPTY_ACCOUNT_FORM = { alias: "", password: "", role: "Viewer" as AccessRole, grants: [] as Capability[] };

function AddAccountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
  const [form, setForm] = useState(EMPTY_ACCOUNT_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_ACCOUNT_FORM);
  const guard = useDirtyGuard(isDirty, onClose);

  function toggleGrant(capability: Capability) {
    setForm((f) => ({
      ...f,
      grants: f.grants.includes(capability) ? f.grants.filter((g) => g !== capability) : [...f.grants, capability]
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const result = await window.tasksheet.auth.createAccount(form);
    setSaving(false);
    if (result.kind === "success") {
      onCreated();
      onClose();
    } else {
      setSaveError(describeUseCaseError(result));
    }
  }

  return (
    <>
      <Dialog titleId="add-account-title" title="Add user" onRequestClose={guard.requestClose} inert={guard.confirmOpen || Boolean(saveError)}>
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="account-alias">Login name</label>
            <input id="account-alias" required value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="account-password">Initial password</label>
            <input
              id="account-password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="account-role">Access role</label>
            <select
              id="account-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as AccessRole, grants: [] })}
            >
              <option value="Viewer">Viewer — view and print only</option>
              <option value="Editor">Editor — create/edit operational records</option>
              <option value="Administrator">Administrator — full access</option>
            </select>
          </div>
          {form.role === "Editor" && (
            <div className="field">
              <label>Additional grants</label>
              {GRANTABLE_EDITOR_CAPABILITIES.map((capability) => (
                <label key={capability} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                  <input type="checkbox" checked={form.grants.includes(capability)} onChange={() => toggleGrant(capability)} />
                  {capability}
                </label>
              ))}
            </div>
          )}
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Add user"}
          </button>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </>
  );
}

function EditGrantsDialog({
  account,
  onClose,
  onSaved
}: {
  account: PublicAccount;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const initial = { role: account.role, grants: [...account.grants] };
  const [role, setRole] = useState<AccessRole>(initial.role);
  const [grants, setGrants] = useState<Capability[]>(initial.grants);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = role !== initial.role || JSON.stringify([...grants].sort()) !== JSON.stringify([...initial.grants].sort());
  const guard = useDirtyGuard(isDirty, onClose);

  function toggleGrant(capability: Capability) {
    setGrants((g) => (g.includes(capability) ? g.filter((x) => x !== capability) : [...g, capability]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const result = await window.tasksheet.auth.setAccountRoleAndGrants({ targetAccountId: account.id, role, grants });
    setSaving(false);
    if (result.kind === "success") {
      onSaved();
      onClose();
    } else {
      setSaveError(describeUseCaseError(result));
    }
  }

  return (
    <>
      <Dialog
        titleId="edit-account-title"
        title={`Edit role & grants — ${account.alias}`}
        onRequestClose={guard.requestClose}
        inert={guard.confirmOpen || Boolean(saveError)}
      >
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="edit-account-role">Access role</label>
            <select id="edit-account-role" value={role} onChange={(e) => setRole(e.target.value as AccessRole)}>
              <option value="Viewer">Viewer</option>
              <option value="Editor">Editor</option>
              <option value="Administrator">Administrator</option>
            </select>
          </div>
          {role === "Editor" && (
            <div className="field">
              <label>Additional grants</label>
              {GRANTABLE_EDITOR_CAPABILITIES.map((capability) => (
                <label key={capability} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
                  <input type="checkbox" checked={grants.includes(capability)} onChange={() => toggleGrant(capability)} />
                  {capability}
                </label>
              ))}
            </div>
          )}
          <p className="field-hint">Saving this revokes the account&apos;s current session; it must sign in again.</p>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </>
  );
}

const EMPTY_RESET_FORM = { adminCurrentPassword: "", newPassword: "" };

function ResetPasswordDialog({
  account,
  onClose,
  onDone
}: {
  account: PublicAccount;
  onClose: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const [form, setForm] = useState(EMPTY_RESET_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_RESET_FORM);
  const guard = useDirtyGuard(isDirty, onClose);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const result = await window.tasksheet.auth.adminResetPassword({
      adminCurrentPassword: form.adminCurrentPassword,
      targetAccountId: account.id,
      newPassword: form.newPassword
    });
    setSaving(false);
    if (result.kind === "success") {
      onDone();
      onClose();
    } else {
      setSaveError(describeUseCaseError(result));
    }
  }

  return (
    <>
      <Dialog
        titleId="reset-password-title"
        title={`Reset password — ${account.alias}`}
        onRequestClose={guard.requestClose}
        inert={guard.confirmOpen || Boolean(saveError)}
      >
        <form onSubmit={onSubmit} noValidate>
          <p className="field-hint">Resetting requires your own current password and forces this user to change theirs at next sign-in.</p>
          <div className="field">
            <label htmlFor="reset-admin-password">Your current password</label>
            <input
              id="reset-admin-password"
              type="password"
              required
              value={form.adminCurrentPassword}
              onChange={(e) => setForm({ ...form, adminCurrentPassword: e.target.value })}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="reset-new-password">New password for {account.alias}</label>
            <input
              id="reset-new-password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? "Resetting…" : "Reset password"}
          </button>
        </form>
      </Dialog>
      {guard.confirmOpen && <ConfirmDiscardDialog onKeepEditing={guard.keepEditing} onDiscard={guard.discard} />}
      {saveError && <SaveErrorDialog message={saveError} onClose={() => setSaveError(null)} />}
    </>
  );
}

export function UsersAndAccessPanel(): React.JSX.Element {
  const { session, refresh } = useAuth();
  const [accounts, setAccounts] = useState<readonly PublicAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PublicAccount | null>(null);
  const [resetting, setResetting] = useState<PublicAccount | null>(null);

  function reload() {
    window.tasksheet.auth.listAccounts().then((result) => {
      const value = unwrapQuery(result, refresh, setError);
      if (value) setAccounts(value);
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, []);

  async function toggleEnabled(account: PublicAccount) {
    setError(null);
    const result = await window.tasksheet.auth.setAccountEnabled({ targetAccountId: account.id, enabled: !account.enabled });
    if (result.kind === "success") reload();
    else setError(describeUseCaseError(result));
  }

  return (
    <div className="panel">
      <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Users &amp; Access</h2>
        <button className="btn btn--primary" onClick={() => setAddOpen(true)}>
          Add user
        </button>
      </div>
      <p className="field-hint">Signed in as {session.alias} ({session.role}). No password or verifier is ever shown here.</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {accounts === null && <p role="status">Loading…</p>}
      {accounts !== null && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Login name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.alias}</td>
                <td>
                  {a.role}
                  {a.role === "Editor" && a.grants.length > 0 ? ` (+${a.grants.length} grant${a.grants.length === 1 ? "" : "s"})` : ""}
                </td>
                <td>{a.enabled ? "Enabled" : "Disabled"}</td>
                <td className="toolbar">
                  <button className="btn" onClick={() => setEditing(a)}>
                    Edit role/grants
                  </button>
                  <button className="btn" onClick={() => setResetting(a)}>
                    Reset password
                  </button>
                  <button className="btn btn--danger" onClick={() => toggleEnabled(a)}>
                    {a.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {addOpen && <AddAccountDialog onClose={() => setAddOpen(false)} onCreated={reload} />}
      {editing && <EditGrantsDialog account={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {resetting && <ResetPasswordDialog account={resetting} onClose={() => setResetting(null)} onDone={reload} />}
    </div>
  );
}
