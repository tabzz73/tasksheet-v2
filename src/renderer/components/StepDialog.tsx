import React from "react";
import { Dialog } from "./Dialog.js";

export interface StepDialogProps {
  titleId: string;
  title: string;
  steps: readonly string[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onRequestClose: () => void;
  inert?: boolean;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  isLastStep: boolean;
  submitting?: boolean;
  submitLabel?: string;
}

/**
 * Shared stepped-editor shell (UI-UX-SPEC.md §6): named steps with a
 * visible position indicator, Back/Next/Save in a persistent footer, and
 * direct navigation to any earlier step (used by the Review step's Edit
 * links). Draft state itself is owned by the caller and never reset on
 * step change.
 */
export function StepDialog({
  titleId,
  title,
  steps,
  currentStep,
  onStepChange,
  onRequestClose,
  inert,
  children,
  onBack,
  onNext,
  isLastStep,
  submitting,
  submitLabel = "Save"
}: StepDialogProps): React.JSX.Element {
  return (
    <Dialog
      titleId={titleId}
      title={title}
      onRequestClose={onRequestClose}
      inert={inert}
      stepped
      footer={
        <>
          {currentStep > 0 && (
            <button type="button" className="btn" onClick={onBack} disabled={submitting}>
              Back
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onNext} disabled={submitting}>
            {isLastStep ? (submitting ? "Saving…" : submitLabel) : "Next"}
          </button>
        </>
      }
    >
      <nav aria-label="Step" style={{ marginBottom: 16 }}>
        <ol style={{ display: "flex", gap: 8, listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}>
          {steps.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                className="btn"
                aria-current={i === currentStep ? "step" : undefined}
                disabled={i > currentStep}
                onClick={() => i <= currentStep && onStepChange(i)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  background: i === currentStep ? "var(--color-accent)" : "transparent",
                  color: i === currentStep ? "var(--color-accent-ink)" : "inherit"
                }}
              >
                {i + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {children}
    </Dialog>
  );
}
