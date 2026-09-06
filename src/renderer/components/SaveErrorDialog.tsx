import React from "react";
import { Dialog } from "./Dialog.js";

/**
 * The separate centered "Could not save" / "Review task details" attention
 * dialog (UI-UX-SPEC.md §7) — distinct from inline field hints and from the
 * dirty-exit ConfirmDiscardDialog. Used for submit-time validation failures
 * and storage/save errors so they never render as a paragraph buried in
 * the form body.
 */
export function SaveErrorDialog({
  title = "Could not save",
  message,
  onClose
}: {
  title?: string;
  message: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="attention-dialog">
      <Dialog
        titleId="save-error-title"
        title={title}
        onRequestClose={onClose}
        footer={
          <button className="btn btn--primary" onClick={onClose} autoFocus>
            Review fields
          </button>
        }
      >
        <p>{message}</p>
        <p className="field-hint">Your draft has been kept — nothing else was changed.</p>
      </Dialog>
    </div>
  );
}
