import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AssignmentSheet } from "../../src/renderer/print/AssignmentSheet.js";
import { GUIDE_NOTICE, type AssignmentDocumentModel } from "../../src/domain/generation.js";

const facilityHeader = {
  name: "Fictional Pines Care Home",
  addressLine1: "1 Fictional Way",
  addressLine2: null,
  mainPhone: "555-0100",
  nursingPhone: null,
  fax: null
};

/** Test fixtures use plain date/instant strings rather than the branded LocalDate/Instant types. */
function makeDocument(overrides: Record<string, unknown>): AssignmentDocumentModel {
  return {
    kind: "hca-assignment",
    modelVersion: 1,
    facilityHeader,
    requestedContext: {
      date: "2026-09-05",
      shiftId: "shift-1",
      shiftName: "Day HCA",
      shiftShortCode: "D1",
      role: "HCA",
      generatedAt: "2026-09-05T12:00:00.000Z",
      sourceDatasetRevision: 1
    },
    warnings: [],
    rows: [],
    notice: GUIDE_NOTICE,
    ...overrides
  } as unknown as AssignmentDocumentModel;
}

const LONG_INSTRUCTION =
  "Check dressing every shift for signs of infection, redness, swelling, or drainage. " +
  "Notify the charge nurse immediately of any change and document findings in the approved clinical record. " +
  "This instruction is intentionally long to verify the print sheet never truncates clinically relevant text.";

describe("AssignmentSheet — required columns (PRD.md §19.2/§19.3)", () => {
  it("HCA sheet uses exactly the approved 7 columns and omits Vitals/Results", () => {
    render(<AssignmentSheet document={makeDocument({ kind: "hca-assignment" })} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["☐", "Time", "Room", "Resident", "Task", "Important Information", "Notes"]);
    expect(screen.queryByText("Vitals / Results")).not.toBeInTheDocument();
  });

  it("LPN sheet adds the Vitals / Results column and renames the last column Notes / Follow-up", () => {
    render(
      <AssignmentSheet
        document={makeDocument({
          kind: "lpn-assignment",
          requestedContext: {
            date: "2026-09-05",
            shiftId: "shift-2",
            shiftName: "Day LPN",
            shiftShortCode: "D1LPN",
            role: "LPN",
            generatedAt: "2026-09-05T12:00:00.000Z",
            sourceDatasetRevision: 1
          }
        })}
      />
    );
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["☐", "Time", "Room", "Resident", "Task", "Important Information", "Vitals / Results", "Notes / Follow-up"]);
  });

  it("includes the exact approved guide/source-of-truth notice on every primary sheet", () => {
    render(<AssignmentSheet document={makeDocument({})} />);
    expect(
      screen.getByText(
        "This sheet is a guide only. Facility policy and the approved clinical record remain the source of truth. Report any discrepancies or unclear instructions to the team lead."
      )
    ).toBeInTheDocument();
  });

  it("shows an explicit empty state rather than an empty table when there are no due tasks", () => {
    render(<AssignmentSheet document={makeDocument({ rows: [] })} />);
    expect(screen.getByText("No due tasks for this date and shift.")).toBeInTheDocument();
  });
});

describe("AssignmentSheet — never truncates clinically relevant text (UI-UX-SPEC.md §4)", () => {
  it("renders a long Important Information value in full, with no ellipsis and no character limit applied", () => {
    render(
      <AssignmentSheet
        document={makeDocument({
          rows: [
            {
              taskId: "t1",
              occurrenceKey: "t1:1:2026-09-05:0900",
              time: "0900",
              room: "101",
              residentFirstName: "Fictional",
              residentLastName: "Resident-With-A-Very-Long-Last-Name-Indeed",
              taskName: "Wound check",
              importantInformation: LONG_INSTRUCTION
            }
          ]
        })}
      />
    );
    // The full string must be present verbatim — a truncating implementation
    // would slice it and/or append an ellipsis, which this exact match rejects.
    expect(screen.getByText(LONG_INSTRUCTION)).toBeInTheDocument();
    expect(screen.queryByText(/…$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Resident-With-A-Very-Long-Last-Name-Indeed/)).toBeInTheDocument();
  });

  it("preserves distinct rows for repeated same-time occurrences rather than merging them", () => {
    render(
      <AssignmentSheet
        document={makeDocument({
          rows: [
            {
              taskId: "t1",
              occurrenceKey: "t1:1:2026-09-05:0900",
              time: "0900",
              room: "101",
              residentFirstName: "A",
              residentLastName: "One",
              taskName: "Blood glucose check",
              importantInformation: null
            },
            {
              taskId: "t2",
              occurrenceKey: "t2:1:2026-09-05:0900",
              time: "0900",
              room: "102",
              residentFirstName: "B",
              residentLastName: "Two",
              taskName: "Blood glucose check",
              importantInformation: null
            }
          ]
        })}
      />
    );
    const rows = screen.getAllByRole("row");
    // Header row + 2 data rows — never consolidated into one.
    expect(rows).toHaveLength(3);
  });

  it("surfaces generation warnings (e.g. an unplaced resident) visibly rather than silently dropping the task", () => {
    render(<AssignmentSheet document={makeDocument({ warnings: ["Fictional Resident has no current bed placement; task omitted."] })} />);
    expect(screen.getByText(/no current bed placement/)).toBeInTheDocument();
  });
});

describe("Print CSS enforces ink/paper economy and header repetition (PRD.md §19.1/§21.3)", () => {
  const css = readFileSync(resolve(process.cwd(), "src/renderer/styles/app.css"), "utf8");

  it("repeats table headers across pages via thead's table-header-group display", () => {
    expect(css).toMatch(/\.print-sheet\s+thead\s*{[^}]*display:\s*table-header-group/);
  });

  it("avoids splitting a data row across a page break", () => {
    expect(css).toMatch(/\.print-sheet\s+tr\s*{[^}]*page-break-inside:\s*avoid/);
  });

  it("never truncates cell text with white-space:nowrap or text-overflow:ellipsis", () => {
    expect(css).not.toMatch(/\.print-sheet[^{]*{[^}]*text-overflow:\s*ellipsis/);
    expect(css).not.toMatch(/\.print-sheet\s+(th|td)[^{]*{[^}]*white-space:\s*nowrap/);
  });

  it("uses a white background and black text for the print sheet (no decorative fills)", () => {
    const block = css.match(/\.print-sheet\s*{[^}]*}/)?.[0] ?? "";
    expect(block).toMatch(/background:\s*white/);
    expect(block).toMatch(/color:\s*black/);
  });

  it("hides screen chrome and shows only the print sheet under @media print", () => {
    const mediaBlock = css.match(/@media print\s*{[\s\S]*}/)?.[0] ?? "";
    expect(mediaBlock).toMatch(/body \*\s*{\s*visibility:\s*hidden/);
    expect(mediaBlock).toMatch(/\.print-sheet[^{]*{\s*visibility:\s*visible/);
  });
});

describe("HCA is denser than LPN by column count, per role", () => {
  it("HCA has strictly fewer columns than the equivalent LPN sheet", () => {
    const { container: hcaContainer } = render(<AssignmentSheet document={makeDocument({ kind: "hca-assignment" })} />);
    const hcaColumns = within(hcaContainer).getAllByRole("columnheader").length;

    const { container: lpnContainer } = render(
      <AssignmentSheet
        document={makeDocument({
          kind: "lpn-assignment",
          requestedContext: {
            date: "2026-09-05",
            shiftId: "shift-2",
            shiftName: "Day LPN",
            shiftShortCode: "D1LPN",
            role: "LPN",
            generatedAt: "2026-09-05T12:00:00.000Z",
            sourceDatasetRevision: 1
          }
        })}
      />
    );
    const lpnColumns = within(lpnContainer).getAllByRole("columnheader").length;

    expect(hcaColumns).toBeLessThan(lpnColumns);
  });
});
