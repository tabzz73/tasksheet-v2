import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResidentsPage } from "../../src/renderer/pages/ResidentsPage.js";
import { AuthProvider } from "../../src/renderer/auth/AuthContext.js";

function mockApi() {
  const rooms = [{ id: "room-1", label: "101", sortKey: "101", active: true }];
  const beds = [{ id: "bed-1", roomId: "room-1", label: "A", active: true }];
  const residents: unknown[] = [];
  const placements: unknown[] = [];
  const shifts = [{ id: "shift-1", shortCode: "D1", name: "Day HCA", role: "HCA", startMinutes: 420, endMinutes: 900, active: true, displayOrder: 0 }];

  (window as unknown as { tasksheet: unknown }).tasksheet = {
    rooms: { list: vi.fn(async () => ({ kind: "success", value: rooms })), create: vi.fn() },
    beds: { list: vi.fn(async () => ({ kind: "success", value: beds })), create: vi.fn() },
    shifts: { list: vi.fn(async () => ({ kind: "success", value: shifts })) },
    residents: {
      list: vi.fn(async () => ({ kind: "success", value: residents })),
      create: vi.fn(async (input: { firstName: string; lastName: string }) => {
        const resident = { id: "res-1", ...input, status: "active", source: "manual", sourceBatchId: null };
        residents.push(resident);
        return { kind: "success", value: resident };
      })
    },
    placements: {
      list: vi.fn(async () => ({ kind: "success", value: placements })),
      create: vi.fn(async (input: unknown) => {
        placements.push(input);
        return { kind: "success", value: input };
      })
    },
    residentTasks: {
      listForResident: vi.fn(async () => ({ kind: "success", value: [] })),
      create: vi.fn(async () => ({ kind: "success", value: {} }))
    }
  };
}

function renderAsAdmin() {
  return render(
    <AuthProvider value={{ session: { alias: "admin", role: "Administrator", grants: [], mustChangePassword: false }, refresh: vi.fn(), logout: vi.fn(), lock: vi.fn() }}>
      <ResidentsPage />
    </AuthProvider>
  );
}

describe("ResidentsPage — stepped Add Resident editor (UI-UX-SPEC.md §6)", () => {
  beforeEach(() => {
    mockApi();
  });

  it("retains the Identity step's draft when moving to Placement, and the Review step summarizes both before saving", async () => {
    renderAsAdmin();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add resident" })).not.toBeDisabled());
    await userEvent.click(screen.getByRole("button", { name: "Add resident" }));

    await userEvent.type(screen.getByLabelText("First name"), "Fictional");
    await userEvent.type(screen.getByLabelText("Last name"), "Resident");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    // Step 2: Placement & Status.
    await userEvent.selectOptions(screen.getByLabelText("Bed"), "101 / A");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    // Step 3: Review — shows a summary of both earlier steps.
    expect(screen.getByText(/Fictional Resident/)).toBeInTheDocument();
    expect(screen.getByText(/101 \/ A/)).toBeInTheDocument();

    // Back to Identity via the step nav still has the typed draft.
    await userEvent.click(screen.getByRole("button", { name: "1. Identity" }));
    expect(screen.getByLabelText("First name")).toHaveValue("Fictional");
  });
});
