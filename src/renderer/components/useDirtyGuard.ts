import { useState } from "react";

/**
 * Shared dirty-exit guard (UI-UX-SPEC.md §7): a pristine editor closes
 * immediately; a dirty one raises the separate centered discard
 * confirmation instead of closing directly.
 */
export function useDirtyGuard(isDirty: boolean, onClose: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestClose() {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }

  function keepEditing() {
    setConfirmOpen(false);
  }

  function discard() {
    setConfirmOpen(false);
    onClose();
  }

  return { confirmOpen, requestClose, keepEditing, discard };
}
