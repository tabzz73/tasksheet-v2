import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "../../src/renderer/components/Dialog.js";
import { ConfirmDiscardDialog } from "../../src/renderer/components/ConfirmDiscardDialog.js";

describe("Dialog (UI-UX-SPEC.md §7 focus trap / Escape)", () => {
  it("renders as an accessible modal dialog and focuses its first control", () => {
    render(
      <Dialog titleId="t" title="Test dialog" onRequestClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("calls onRequestClose on Escape", () => {
    const onRequestClose = vi.fn();
    render(
      <Dialog titleId="t" title="Test dialog" onRequestClose={onRequestClose}>
        <button>First</button>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape while inert (an attention dialog is on top)", () => {
    const onRequestClose = vi.fn();
    render(
      <Dialog titleId="t" title="Test dialog" onRequestClose={onRequestClose} inert>
        <button>First</button>
      </Dialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("clicking the backdrop closes the dialog, clicking inside it does not", () => {
    const onRequestClose = vi.fn();
    const { container } = render(
      <Dialog titleId="t" title="Test dialog" onRequestClose={onRequestClose}>
        <button>First</button>
      </Dialog>
    );
    const backdrop = container.querySelector(".dialog-backdrop")!;
    fireEvent.mouseDown(screen.getByRole("button", { name: "First" }));
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDiscardDialog (the one required centered attention dialog)", () => {
  it("defaults focus to the safe Keep editing action, never Discard", () => {
    render(<ConfirmDiscardDialog onKeepEditing={() => {}} onDiscard={() => {}} />);
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
  });

  it("Discard changes invokes onDiscard", () => {
    const onDiscard = vi.fn();
    render(<ConfirmDiscardDialog onKeepEditing={() => {}} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
