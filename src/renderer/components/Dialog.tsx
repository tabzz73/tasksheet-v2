import React, { useEffect, useRef } from "react";

export interface DialogProps {
  titleId: string;
  title: string;
  onRequestClose: () => void;
  stepped?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** When true, Escape and backdrop clicks are ignored (an attention dialog is on top). */
  inert?: boolean;
}

/**
 * A single focus-trapping dialog. Only one Dialog should be the active trap
 * at a time — when an attention dialog is shown over an editor, the editor
 * dialog is rendered with `inert` so the background stays visually present
 * but keyboard/pointer-inert (UI-UX-SPEC.md §7).
 */
export function Dialog({ titleId, title, onRequestClose, stepped, children, footer, inert }: DialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null);
  // `onRequestClose` is commonly a fresh closure on every parent render
  // (e.g. from useDirtyGuard). Reading it via a ref keeps the focus/keydown
  // effect below from re-running — and stealing focus back to the first
  // control — on every keystroke inside the dialog's own form fields.
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  useEffect(() => {
    if (inert) return;
    const node = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const parts = ["button", "[href]", "input", "select", "textarea", '[tabindex]:not([tabindex="-1"])'];
    const focusableSelector = parts.join(", ");
    const focusable = node?.querySelectorAll<HTMLElement>(focusableSelector);
    // React applies a child's `autoFocus` during commit, before this effect
    // runs. Only fall back to a default (skipping the header's Close
    // button, which is otherwise always first in DOM order) when nothing
    // inside already claimed focus, so an explicit autoFocus — e.g. the
    // safe default action in a footer per UI-UX-SPEC.md §7 — is never
    // overridden.
    if (!(node && document.activeElement && node.contains(document.activeElement) && document.activeElement !== node)) {
      const defaultSelector = parts.flatMap((p) => [`.dialog__body ${p}`, `.dialog__footer ${p}`]).join(", ");
      const defaultTarget = node?.querySelector<HTMLElement>(defaultSelector);
      (defaultTarget ?? focusable?.[0])?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onRequestCloseRef.current();
        return;
      }
      if (event.key === "Tab" && focusable && focusable.length > 0) {
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [inert]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (!inert && e.target === e.currentTarget) onRequestClose();
      }}
      aria-hidden={inert ? true : undefined}
    >
      <div
        ref={dialogRef}
        className={`dialog${stepped ? " dialog--stepped" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={inert ? { pointerEvents: "none", opacity: 0.6 } : undefined}
      >
        <div className="dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button className="btn" aria-label="Close dialog" onClick={onRequestClose} disabled={inert}>
            ✕
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer ? <div className="dialog__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
