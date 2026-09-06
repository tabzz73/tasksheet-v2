import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/renderer/App.js";

const facility = {
  facilityId: "facility-1",
  name: "Fictional Pines",
  addressLine1: "1 Fictional Way",
  addressLine2: null,
  mainPhone: "555-0100",
  nursingPhone: null,
  fax: null,
  timeZone: "America/Denver",
  weekStart: 1,
  escalationThreshold: 3,
  inactivityLockMinutes: 10
};

const activeSession = { alias: "admin", role: "Administrator", grants: [], mustChangePassword: false };

/** A mutable statusRef lets a test simulate the main process changing session
 * state out from under the renderer (idle sweep, OS suspend, revocation) —
 * exactly the case the App's poll effect exists to notice. */
function mockApi(statusRef: { current: unknown }) {
  (window as unknown as { tasksheet: unknown }).tasksheet = {
    auth: {
      needsBootstrap: vi.fn(async () => false),
      sessionStatus: vi.fn(async () => statusRef.current),
      currentSession: vi.fn(async () => activeSession),
      lock: vi.fn(async () => {
        statusRef.current = { status: "locked", alias: "admin" };
      }),
      unlock: vi.fn(async (input: { password: string }) => {
        if (input.password !== "correct-horse") {
          return { kind: "forbidden", reason: "Password is incorrect." };
        }
        statusRef.current = { status: "active", session: activeSession };
        return { kind: "success", value: activeSession };
      }),
      logout: vi.fn(async () => {
        statusRef.current = { status: "none" };
      })
    },
    facility: {
      get: vi.fn(async () => ({ kind: "success", value: facility })),
      save: vi.fn(async () => ({ kind: "success", value: facility }))
    },
    shifts: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    rooms: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    beds: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    residents: { list: vi.fn(async () => ({ kind: "success", value: [] })) },
    placements: { list: vi.fn(async () => ({ kind: "success", value: [] })) }
  };
}

describe("App — locking preserves the in-memory draft for same-account recovery (ACCESS-CONTROL.md §5)", () => {
  let statusRef: { current: unknown };

  beforeEach(() => {
    statusRef = { current: { status: "active", session: activeSession } };
    mockApi(statusRef);
  });

  it("Lock does not raise a discard confirmation, and unlocking with the same account's password restores the dirty draft untouched", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines"));
    await userEvent.type(screen.getByLabelText("Facility name"), " Extra");

    await userEvent.click(screen.getByRole("button", { name: "Lock" }));

    // No discard prompt for a lock — it's recoverable, not destructive.
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();

    // The lock overlay demands the same account's password.
    expect(await screen.findByText("Signed in as admin. Enter your password to continue.")).toBeInTheDocument();

    // The dirty draft is still in the DOM underneath the overlay — it was never unmounted.
    expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines Extra");

    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(screen.queryByText("Signed in as admin. Enter your password to continue.")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines Extra");
  });

  it("a wrong password on the lock overlay is rejected and the draft remains locked and intact", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines"));
    await userEvent.type(screen.getByLabelText("Facility name"), " Extra");
    await userEvent.click(screen.getByRole("button", { name: "Lock" }));
    await screen.findByText("Signed in as admin. Enter your password to continue.");

    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByText("Signed in as admin. Enter your password to continue.")).toBeInTheDocument();
    expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines Extra");
  });

  it("logging out (a genuine account boundary) clears the draft rather than preserving it", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines"));
    await userEvent.type(screen.getByLabelText("Facility name"), " Extra");

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument());
    expect(screen.queryByLabelText("Facility name")).not.toBeInTheDocument();
  });
});
