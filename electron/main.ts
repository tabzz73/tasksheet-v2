import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { openDatabase } from "../src/infra/db/connection.js";
import { createSqliteRepositories } from "../src/infra/db/sqliteRepositories.js";
import { SystemClock } from "../src/application/clock.js";
import { IPC_CHANNELS } from "../src/shared/ipc.js";
import { saveFacilitySettings } from "../src/application/useCases/saveFacilitySettings.js";
import { createShift } from "../src/application/useCases/createShift.js";
import { createRoom, createBed } from "../src/application/useCases/roomsAndBeds.js";
import { createResident } from "../src/application/useCases/createResident.js";
import { placeResident } from "../src/application/useCases/placeResident.js";
import { createResidentTask } from "../src/application/useCases/createResidentTask.js";
import { generateAssignmentDocument } from "../src/application/useCases/generateAssignmentDocument.js";
import type { Repositories } from "../src/application/ports.js";

const isDev = !app.isPackaged;
const clock = new SystemClock();
let repos: Repositories;

function dbFilePath(): string {
  return path.join(app.getPath("userData"), "tasksheet.sqlite3");
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.facilityGet, () => repos.facility.get());
  ipcMain.handle(IPC_CHANNELS.facilitySave, (_event, input) => saveFacilitySettings(repos, input));

  ipcMain.handle(IPC_CHANNELS.shiftList, () => repos.shifts.listActive());
  ipcMain.handle(IPC_CHANNELS.shiftCreate, (_event, input) => createShift(repos, input));

  ipcMain.handle(IPC_CHANNELS.roomList, () => repos.rooms.listActive());
  ipcMain.handle(IPC_CHANNELS.roomCreate, (_event, input) => createRoom(repos, input));

  ipcMain.handle(IPC_CHANNELS.bedList, () => repos.beds.listActive());
  ipcMain.handle(IPC_CHANNELS.bedCreate, (_event, input) => createBed(repos, input));

  ipcMain.handle(IPC_CHANNELS.residentList, () => repos.residents.listActive());
  ipcMain.handle(IPC_CHANNELS.residentCreate, (_event, input) => createResident(repos, input));

  ipcMain.handle(IPC_CHANNELS.placementList, () => repos.placements.listCurrent());
  ipcMain.handle(IPC_CHANNELS.placementCreate, (_event, input) => placeResident(repos, input));

  ipcMain.handle(IPC_CHANNELS.residentTaskListForResident, (_event, residentId: string) =>
    repos.residentTasks.listForResident(residentId)
  );
  ipcMain.handle(IPC_CHANNELS.residentTaskCreate, (_event, input) => createResidentTask(repos, input));

  ipcMain.handle(IPC_CHANNELS.assignmentGenerate, (_event, input) => generateAssignmentDocument(repos, clock, input));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
      // `sandbox: true` is intentionally NOT set: Electron's sandboxed
      // preload loader only polyfills a small module allowlist and cannot
      // resolve preload.js's relative require of ../src/shared/ipc.js,
      // which left window.tasksheet undefined and the renderer crashing on
      // first render (confirmed via preload-error during manual smoke
      // testing). contextIsolation + nodeIntegration:false already satisfy
      // AGENTS.md's "minimal renderer privileges" requirement; reinstating
      // the sandbox would need preload.ts bundled into a single
      // dependency-free file first.
    }
  });

  if (isDev) {
    void win.loadURL("http://localhost:5173");
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  const db = openDatabase(dbFilePath());
  repos = createSqliteRepositories(db);
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
