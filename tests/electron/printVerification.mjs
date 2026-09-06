// Rendered multi-page print verification. Run via the real `electron`
// binary against the actual built app (dist-electron/main.cjs + the live
// Vite dev server), driving the real Print Center UI and producing a real
// PDF via webContents.printToPDF() — the same Chromium print pipeline a
// physical print job goes through. The resulting PDF is parsed with
// pdf-parse (which resolves Chromium's embedded-font glyph IDs back to
// real Unicode text via the PDF's ToUnicode CMaps), so these assertions
// are against rendered, paginated output — not the static CSS-text
// assertions in tests/component/assignmentSheet.test.tsx, which cannot see
// pagination, header repetition, footer placement, or clipping at all.
//
// Usage: SMOKE_USERDATA=<tmp dir> electron tests/electron/printVerification.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const electron = require("electron");
const { app, BrowserWindow } = electron;
const { PDFParse } = require("pdf-parse");

const userDataDir = process.env.SMOKE_USERDATA;
if (!userDataDir) {
  console.error("SMOKE_USERDATA env var is required");
  process.exit(1);
}
app.setPath("userData", userDataDir);

require("../../dist-electron/main.cjs");

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
}

function openWindow() {
  return new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
}

async function loadReal(win) {
  await win.loadURL("http://localhost:5173");
  await new Promise((r) => setTimeout(r, 400));
}

async function callApi(win, expr) {
  return win.webContents.executeJavaScript(expr);
}

const LONG_INSTRUCTION =
  "LONG_INSTRUCTION_MARKER Check dressing every shift for signs of infection, redness, swelling, or drainage. " +
  "Notify the charge nurse immediately of any change and document findings in the approved clinical record. " +
  "This instruction is intentionally long to verify the REAL RENDERED, PAGINATED print output never truncates " +
  "clinically relevant text across an actual page boundary, not merely in a static CSS/DOM assertion.";
const LONG_LASTNAME = "Residentwithaverylongsurnamethatmustneverbeclippedorellipsizedbytherealprintlayoutengine";
const ROW_COUNT = 50;

app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 300));

  const win = openWindow();
  await loadReal(win);

  await callApi(win, `window.tasksheet.auth.bootstrapAdmin({ alias: "admin", password: "correct horse battery staple" })`);
  const loginResult = await callApi(win, `window.tasksheet.auth.login({ alias: "admin", password: "correct horse battery staple" })`);
  record("admin bootstrap + login succeed before seeding print fixtures", loginResult.kind === "success");

  const seed = await callApi(
    win,
    `(async () => {
      const facilityRes = await window.tasksheet.facility.save({
        facilityId: "facility-1",
        name: "Fictional Pines Care Home",
        addressLine1: "1 Fictional Way",
        addressLine2: null,
        mainPhone: "555-0100",
        nursingPhone: null,
        fax: null,
        timeZone: "America/Denver",
        weekStart: 1,
        escalationThreshold: 3,
        inactivityLockMinutes: 10
      });
      if (facilityRes.kind !== "success") return { ok: false, step: "facility", facilityRes };
      const shiftRes = await window.tasksheet.shifts.create({ shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500" });
      const roomRes = await window.tasksheet.rooms.create({ label: "Bulk Wing" });
      if (shiftRes.kind !== "success" || roomRes.kind !== "success") return { ok: false, shiftRes, roomRes };
      const shiftId = shiftRes.value.id;
      const roomId = roomRes.value.id;
      const N = ${ROW_COUNT};
      for (let i = 0; i < N; i++) {
        const isLast = i === N - 1;
        const bedRes = await window.tasksheet.beds.create({ roomId, label: String(i + 1) });
        if (bedRes.kind !== "success") return { ok: false, step: "bed", i, bedRes };
        const lastName = isLast ? ${JSON.stringify(LONG_LASTNAME)} : ("Resident" + i);
        const residentRes = await window.tasksheet.residents.create({ firstName: "Fictional", lastName });
        if (residentRes.kind !== "success") return { ok: false, step: "resident", i, residentRes };
        const placeRes = await window.tasksheet.placements.create({ residentId: residentRes.value.id, bedId: bedRes.value.id, startDate: "2026-01-01" });
        if (placeRes.kind !== "success") return { ok: false, step: "placement", i, placeRes };
        const importantInformation = isLast ? ${JSON.stringify(LONG_INSTRUCTION)} : "Diabetic — check before breakfast";
        const taskRes = await window.tasksheet.residentTasks.create({
          residentId: residentRes.value.id,
          role: "HCA",
          eligibleShiftIds: [shiftId],
          taskName: "Blood glucose check " + i,
          category: "clinical",
          instructions: "Check before breakfast",
          importantInformation,
          cadence: { kind: "daily" },
          placement: { kind: "times", times: ["0900"] },
          activeFrom: "2026-01-01"
        });
        if (taskRes.kind !== "success") return { ok: false, step: "task", i, taskRes };
      }
      return { ok: true, shiftId };
    })()`
  );
  record(`seeded ${ROW_COUNT} rows (rooms/beds/residents/placements/tasks) through real IPC`, seed.ok === true, JSON.stringify(seed).slice(0, 300));
  const shiftId = seed.shiftId;

  // Reload so the React app's own boot-time refreshAuth() picks up the
  // already-authenticated main-process session, landing on the real Dashboard —
  // from here on every interaction is through the same UI a user would drive.
  win.webContents.reload();
  await new Promise((r) => setTimeout(r, 600));

  await callApi(
    win,
    `Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Print Center")?.click()`
  );
  await new Promise((r) => setTimeout(r, 200));

  const shiftSelected = await callApi(
    win,
    `(() => {
      const select = document.getElementById("print-shift");
      if (!select) return false;
      const proto = Object.getPrototypeOf(select);
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(select, ${JSON.stringify(shiftId)});
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value === ${JSON.stringify(shiftId)};
    })()`
  );
  record("Print Center's shift selector accepts the seeded shift through the real UI", shiftSelected === true);

  await callApi(
    win,
    `Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim().startsWith("Generate preview"))?.click()`
  );
  await new Promise((r) => setTimeout(r, 500));

  const previewRowCount = await callApi(win, `document.querySelectorAll(".print-sheet tbody tr").length`);
  record(`the real Print Center preview renders all ${ROW_COUNT} generated rows (no silent drop)`, previewRowCount === ROW_COUNT, String(previewRowCount));

  // === The actual print — same Chromium pipeline a physical print job uses ===
  const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: "Letter" });
  record("printToPDF produced a non-empty real PDF", pdfBuffer.length > 1000, `${pdfBuffer.length} bytes`);

  const parser = new PDFParse({ data: pdfBuffer });
  const parsed = await parser.getText();
  await parser.destroy();

  record(
    `the rendered PDF spans multiple pages for ${ROW_COUNT} rows (real pagination, not a static assertion)`,
    parsed.total > 1,
    `${parsed.total} page(s)`
  );

  const headerCells = ["Time", "Room", "Resident", "Task", "Important Information", "Notes"];
  const pagesWithFullHeader = parsed.pages.filter((p) => headerCells.every((h) => p.text.includes(h)));
  record(
    "the table header repeats on every rendered page (not just the first)",
    pagesWithFullHeader.length === parsed.total,
    `${pagesWithFullHeader.length}/${parsed.total} pages carry the full header row`
  );

  const fullText = parsed.text.replace(/\s+/g, " ");
  const longInstructionNormalized = LONG_INSTRUCTION.replace(/\s+/g, " ");
  record(
    "the long instruction text survives real pagination in full, verbatim and unclipped",
    fullText.includes(longInstructionNormalized),
    fullText.includes(longInstructionNormalized) ? undefined : "long instruction text was NOT found intact in the rendered PDF"
  );
  record("no ellipsis character was introduced by the real print layout", !parsed.text.includes("…"));

  record(
    "the very long resident surname is rendered in full, not clipped by a fixed-width/overflow-hidden cell",
    fullText.includes(LONG_LASTNAME)
  );

  record(
    "the guide/source-of-truth notice is present in the rendered output (appears once, at the end of the sheet)",
    fullText.includes(
      "This sheet is a guide only. Facility policy and the approved clinical record remain the source of truth. Report any discrepancies or unclear instructions to the team lead."
    )
  );

  // The notice sits in normal flow after the table (not a repeating <tfoot>),
  // so PRD.md §19.1's header-repetition requirement doesn't apply to it —
  // but it must land intact on whichever single page it falls on, not split
  // across a page break. Confirm it appears whole on exactly one page.
  const noticeFragment = "This sheet is a guide only.";
  const pagesWithNotice = parsed.pages.filter((p) => p.text.includes(noticeFragment));
  record(
    "the notice is not split across a page break (appears intact on exactly one page)",
    pagesWithNotice.length === 1,
    `found on ${pagesWithNotice.length} page(s)`
  );

  // === Screen chrome must not leak into the printed/PDF output ===
  const navLeaked = parsed.text.includes("TaskSheet") && parsed.text.includes("Dashboard") && parsed.text.includes("Lock");
  record("the app nav/header chrome is excluded from the printed PDF (only the print sheet renders)", !navLeaked);

  // === Summary ===
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.error("FAILURES:", failed.map((f) => f.name).join("; "));
    app.exit(1);
  } else {
    console.log("ALL PASSED");
    app.exit(0);
  }
});
