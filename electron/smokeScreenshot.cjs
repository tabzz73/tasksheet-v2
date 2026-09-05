const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { openDatabase } = require("../src/infra/db/connection");
const { createSqliteRepositories } = require("../src/infra/db/sqliteRepositories");
const { IPC_CHANNELS } = require("../src/shared/ipc");
const { saveFacilitySettings } = require("../src/application/useCases/saveFacilitySettings");
const { createShift } = require("../src/application/useCases/createShift");
const { createRoom, createBed } = require("../src/application/useCases/roomsAndBeds");
const { createResident } = require("../src/application/useCases/createResident");
const { placeResident } = require("../src/application/useCases/placeResident");
const { createResidentTask } = require("../src/application/useCases/createResidentTask");
const { generateAssignmentDocument } = require("../src/application/useCases/generateAssignmentDocument");
const { SystemClock } = require("../src/application/clock");
const { ipcMain } = require("electron");

const outDir = process.env.SMOKE_OUT_DIR;

app.whenReady().then(async () => {
  const db = openDatabase(path.join(app.getPath("userData"), "tasksheet.sqlite3"));
  const repos = createSqliteRepositories(db);
  const clock = new SystemClock();

  ipcMain.handle(IPC_CHANNELS.facilityGet, () => repos.facility.get());
  ipcMain.handle(IPC_CHANNELS.facilitySave, (_e, input) => saveFacilitySettings(repos, input));
  ipcMain.handle(IPC_CHANNELS.shiftList, () => repos.shifts.listActive());
  ipcMain.handle(IPC_CHANNELS.shiftCreate, (_e, input) => createShift(repos, input));
  ipcMain.handle(IPC_CHANNELS.roomList, () => repos.rooms.listActive());
  ipcMain.handle(IPC_CHANNELS.roomCreate, (_e, input) => createRoom(repos, input));
  ipcMain.handle(IPC_CHANNELS.bedList, () => repos.beds.listActive());
  ipcMain.handle(IPC_CHANNELS.bedCreate, (_e, input) => createBed(repos, input));
  ipcMain.handle(IPC_CHANNELS.residentList, () => repos.residents.listActive());
  ipcMain.handle(IPC_CHANNELS.residentCreate, (_e, input) => createResident(repos, input));
  ipcMain.handle(IPC_CHANNELS.placementList, () => repos.placements.listCurrent());
  ipcMain.handle(IPC_CHANNELS.placementCreate, (_e, input) => placeResident(repos, input));
  ipcMain.handle(IPC_CHANNELS.residentTaskListForResident, (_e, id) => repos.residentTasks.listForResident(id));
  ipcMain.handle(IPC_CHANNELS.residentTaskCreate, (_e, input) => createResidentTask(repos, input));
  ipcMain.handle(IPC_CHANNELS.assignmentGenerate, (_e, input) => generateAssignmentDocument(repos, clock, input));

  // Seed the same fixture the automated AC-02/03 tests use, through the
  // real use cases (not direct SQL), so the screenshot shows genuine
  // generated output rather than hand-crafted DOM.
  await saveFacilitySettings(repos, {
    facilityId: "facility-1",
    name: "Fictional Pines Care Home",
    addressLine1: "1 Fictional Way",
    addressLine2: null,
    mainPhone: "555-0100",
    nursingPhone: "555-0101",
    fax: null,
    timeZone: "America/Denver",
    weekStart: 1,
    escalationThreshold: 3
  });
  const shift = createShift(repos, { shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500" }).value;
  const room = createRoom(repos, { label: "101" }).value;
  const bed = createBed(repos, { roomId: room.id, label: "A" }).value;
  const resident = createResident(repos, { firstName: "Fictional", lastName: "Resident" }).value;
  placeResident(repos, { residentId: resident.id, bedId: bed.id, startDate: "2026-01-01" });
  createResidentTask(repos, {
    residentId: resident.id,
    role: "HCA",
    eligibleShiftIds: [shift.id],
    taskName: "Blood glucose check",
    importantInformation: "Diabetic — check before breakfast",
    cadence: { kind: "daily" },
    placement: { kind: "times", times: ["0900"] },
    activeFrom: "2026-01-01"
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "..", "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadURL("http://localhost:5173");
  await new Promise((r) => setTimeout(r, 1200));

  async function shot(name) {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, name), image.toPNG());
  }

  await shot("01-settings.png");

  async function clickNav(label) {
    await win.webContents.executeJavaScript(`
      (function() {
        const buttons = Array.from(document.querySelectorAll('.app-nav__link'));
        const btn = buttons.find(b => b.textContent.includes(${JSON.stringify(label)}));
        btn && btn.click();
        return !!btn;
      })();
    `);
    await new Promise((r) => setTimeout(r, 400));
  }

  await clickNav("Residents");
  await shot("02-residents.png");

  await clickNav("Print Center");
  await shot("03-print-center.png");

  // Click the real "Generate preview" button (default date already matches
  // the fixture date, shift auto-selects to the first configured shift) so
  // the screenshot shows the actual button-driven path, not a scripted call.
  await win.webContents.executeJavaScript(`
    (function() {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Generate preview'));
      btn && btn.click();
    })();
  `);
  await new Promise((r) => setTimeout(r, 600));
  await shot("04-print-preview.png");

  const generated = await win.webContents.executeJavaScript(`
    window.tasksheet.assignment.generate({ date: "2026-09-05", shiftId: ${JSON.stringify(shift.id)} })
  `);
  fs.writeFileSync(path.join(outDir, "generated-via-ipc.json"), JSON.stringify(generated, null, 2));

  fs.writeFileSync(path.join(outDir, "generated-document.json"), JSON.stringify(
    await generateAssignmentDocument(repos, clock, { date: "2026-09-05", shiftId: shift.id }), null, 2
  ));

  db.close();
  app.quit();
});
