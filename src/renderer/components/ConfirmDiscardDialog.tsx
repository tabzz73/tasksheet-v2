import React from "react";
import { Dialog } from "./Dialog.js";

export interface ConfirmDiscardDialogProps {
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/**
 * The one required centered attention dialog for a dirty-editor exit
 * (UI-UX-SPEC.md §7). Default focus is the safe "Keep editing" action.
 */
export function ConfirmDiscardDialog({ onKeepEditing, onDiscard }: ConfirmDiscardDialogProps): React.JSX.Element {
  return (
    <div className="attention-dialog">
      <Dialog
        titleId="confirm-discard-title"
        title="Discard unsaved changes?"
        onRequestClose={onKeepEditing}
        footer={
          <>
            <button className="btn btn--danger" onClick={onDiscard}>
              Discard changes
            </button>
            <button className="btn btn--primary" onClick={onKeepEditing} autoFocus>
              Keep editing
            </button>
          </>
        }
      >
        <p>Your changes have not been saved. If you continue, this draft will be lost.</p>
      </Dialog>
    </div>
  );
}
