import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShiftsPage } from "../../src/renderer/pages/ShiftsPage.js";
import { AuthProvider } from "../../src/renderer/auth/AuthContext.js";

function mockApi() {
  const shifts: unknown[] = [];
  (window as unknown as { tasksheet: unknown }).tasksheet = {
    shifts: {
      list: vi.fn(async () => ({ kind: "success", value: shifts })),
      create: vi.fn(async (input: { shortCode: string }) => {
        const shift = { id: "s1", ...input, startMinutes: 420, endMinutes: 900, active: true, displayOrder: 0 };
        shifts.push(shift);
        return { kind: "success", value: shift };
      })
    }
  };
}

function renderAsAdmin() {
  return render(
    <AuthProvider value={{ session: { alias: "admin", role: "Administrator", grants: [], mustChangePassword: false }, refresh: vi.fn(), logout: vi.fn(), lock: vi.fn() }}>
      <ShiftsPage />
    </AuthProvider>
  );
}

describe("ShiftsPage — Add shift dialog dirty-exit guard (AC-28)", () => {
  beforeEach(() => {
    mockApi();
  });

  it("shows an empty state, then lists a created shift", async () => {
    renderAsAdmin();
    expect(await screen.findByText(/No shifts configured yet/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add shift" }));
    const dialog = screen.getByRole("dialog", { name: "Add shift" });
    await userEvent.type(screen.getByLabelText("Short code"), "D1");
    await userEvent.type(screen.getByLabelText("Full name"), "Day HCA");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add shift" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Day HCA")).toBeInTheDocument();
  });

  it("a pristine dialog closes immediately on Escape with no confirmation", async () => {
    renderAsAdmin();
    await userEvent.click(screen.getByRole("button", { name: "Add shift" }));
    expect(screen.getByRole("dialog", { name: "Add shift" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("a dirty dialog raises the centered discard confirmation on Escape, and Keep editing preserves the draft", async () => {
    const { container } = renderAsAdmin();
    await userEvent.click(screen.getByRole("button", { name: "Add shift" }));
    await userEvent.type(screen.getByLabelText("Short code"), "D1");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    // The original editor dialog is still present in the DOM (marked
    // aria-hidden while inert, so it is intentionally invisible to the
    // getByRole accessibility-tree query above — checked via the DOM here).
    expect(container.querySelector("#add-shift-title")?.textContent).toBe("Add shift");

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Short code")).toHaveValue("D1");
  });

  it("Discard changes abandons the dirty draft and closes both dialogs", async () => {
    renderAsAdmin();
    await userEvent.click(screen.getByRole("button", { name: "Add shift" }));
    await userEvent.type(screen.getByLabelText("Short code"), "D1");

    fireEvent.keyDown(document, { key: "Escape" });
    await userEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
