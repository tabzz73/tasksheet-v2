import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/renderer/App.js";

function mockApi() {
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

  (window as unknown as { tasksheet: unknown }).tasksheet = {
    auth: {
      needsBootstrap: vi.fn(async () => false),
      sessionStatus: vi.fn(async () => ({
        status: "active",
        session: { alias: "admin", role: "Administrator", grants: [], mustChangePassword: false }
      })),
      currentSession: vi.fn(async () => ({ alias: "admin", role: "Administrator", grants: [], mustChangePassword: false })),
      lock: vi.fn(async () => {}),
      logout: vi.fn(async () => {})
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

describe("App — cross-page dirty-exit guard (UI-UX-SPEC.md §7: navigation)", () => {
  beforeEach(() => {
    mockApi();
  });

  it("switching nav away from a dirty Facility settings form raises the centered discard confirmation", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines"));

    await userEvent.type(screen.getByLabelText("Facility name"), " Extra");

    await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));

    expect(await screen.findByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    // Still on Settings — the nav did not happen yet.
    expect(screen.getByLabelText("Facility name")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.queryByLabelText("Facility name")).not.toBeInTheDocument());
  });

  it("Keep editing on the nav guard preserves the dirty draft and stays on the page", async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await waitFor(() => expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines"));
    await userEvent.type(screen.getByLabelText("Facility name"), " Extra");

    await userEvent.click(screen.getByRole("button", { name: "Residents" }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep editing" }));

    expect(screen.getByLabelText("Facility name")).toHaveValue("Fictional Pines Extra");
  });
});
