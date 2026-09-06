import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/renderer/App.js";

function mockApi(overrides: { mustChangePassword?: boolean } = {}) {
  const session = { alias: "editor1", role: "Editor", grants: [], mustChangePassword: overrides.mustChangePassword ?? false };
  const changeOwnPassword = vi.fn(async (input: { currentPassword: string; newPassword: string }) => {
    if (input.currentPassword !== "correct current password") {
      return { kind: "forbidden", reason: "Current password is incorrect." };
    }
    return { kind: "success", value: { ...session, mustChangePassword: false } };
  });

  (window as unknown as { tasksheet: unknown }).tasksheet = {
    auth: {
      needsBootstrap: vi.fn(async () => false),
      sessionStatus: vi.fn(async () => ({ status: "active", session })),
      changeOwnPassword
    },
    facility: { get: vi.fn(async () => ({ kind: "success", value: null })) },
    shifts: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    rooms: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    beds: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    residents: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    placements: { list: vi.fn(async () => ({ kind: "success", value: [] })) }
  };
  return { changeOwnPassword };
}

describe("Change password (voluntary) and forced change after an Administrator reset", () => {
  it("a forced reset (mustChangePassword) blocks the app shell with a dedicated page, not a dismissable dialog", async () => {
    mockApi({ mustChangePassword: true });
    render(<App />);

    expect(await screen.findByText(/Change your password/)).toBeInTheDocument();
    // No app nav / protected data is rendered while a forced change is pending.
    expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("a wrong current password on the forced-change page is rejected and the page remains", async () => {
    const { changeOwnPassword } = mockApi({ mustChangePassword: true });
    render(<App />);
    await screen.findByText(/Change your password/);

    await userEvent.type(screen.getByLabelText("Temporary password"), "wrong temp password");
    await userEvent.type(screen.getByLabelText("New password"), "a brand new long enough password");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "a brand new long enough password");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(changeOwnPassword).toHaveBeenCalled();
    expect(await screen.findByText(/Current password is incorrect\./)).toBeInTheDocument();
  });

  it("the header's voluntary Change password dialog requires the current password and closes on success", async () => {
    mockApi({ mustChangePassword: false });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Change password" }));

    const dialog = await screen.findByRole("dialog", { name: "Change password" });
    await userEvent.type(screen.getByLabelText("Current password"), "correct current password");
    await userEvent.type(screen.getByLabelText("New password"), "a brand new long enough password");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "a brand new long enough password");
    await userEvent.click(screen.getAllByRole("button", { name: "Change password" }).find((b) => dialog.contains(b))!);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Change password" })).not.toBeInTheDocument();
  });
});
