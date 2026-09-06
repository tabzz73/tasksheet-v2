import { app, BrowserWindow, ipcMain, powerMonitor } from "electron";
import path from "node:path";
import { openDatabase } from "../src/infra/db/connection.js";
import { createSqliteRepositories } from "../src/infra/db/sqliteRepositories.js";
import { SystemClock } from "../src/application/clock.js";
import { SessionManager } from "../src/application/auth/sessionManager.js";
import { IPC_CHANNELS } from "../src/shared/ipc.js";
import {
  authorizedCreateBed,
  authorizedCreateResident,
  authorizedCreateResidentTask,
  authorizedCreateRoom,
  authorizedCreateShift,
  authorizedDeactivateShift,
  authorizedGenerateAssignment,
  authorizedGetFacility,
  authorizedListBeds,
  authorizedListPlacements,
  authorizedListResidentTasksForResident,
  authorizedListResidents,
  authorizedListRooms,
  authorizedListShifts,
  authorizedPlaceResident,
  authorizedSaveFacilitySettings
} from "../src/application/authorizedUseCases.js";
import {
  adminResetPassword,
  bootstrapFirstAdmin,
  changeOwnPassword,
  createAccount,
  currentSession,
  sessionStatus,
  lock,
  listAccounts,
  listSecurityEvents,
  login,
  logout,
  needsBootstrap,
  recoverWithCode,
  setAccountEnabled,
  setAccountRoleAndGrants,
  unlock
} from "../src/application/useCases/auth.js";
import type { Repositories } from "../src/application/ports.js";

const isDev = !app.isPackaged;
const clock = new SystemClock();
const sessions = new SessionManager();
let repos: Repositories;

/** Default inactivity lock, configurable 5-60 min by an Administrator (ACCESS-CONTROL.md §5). Not yet exposed in Settings UI — see milestone report. */
const IDLE_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

function dbFilePath(): string {
  // Path fixed by docs/adr/ADR-0001-production-persistence-boundary.md.
  return path.join(app.getPath("userData"), "data", "tasksheet.sqlite");
}

/** The sender's webContents id is the sole session key — never a renderer-supplied claim (ACCESS-CONTROL.md §4). */
function senderKeyOf(event: Electron.IpcMainInvokeEvent): string {
  return String(event.sender.id);
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.facilityGet, (e) => authorizedGetFacility(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.facilitySave, (e, input) => authorizedSaveFacilitySettings(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.shiftList, (e) => authorizedListShifts(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.shiftCreate, (e, input) => authorizedCreateShift(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.shiftDeactivate, (e, input) => authorizedDeactivateShift(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.roomList, (e) => authorizedListRooms(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.roomCreate, (e, input) => authorizedCreateRoom(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.bedList, (e) => authorizedListBeds(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.bedCreate, (e, input) => authorizedCreateBed(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.residentList, (e) => authorizedListResidents(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.residentCreate, (e, input) => authorizedCreateResident(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.placementList, (e) => authorizedListPlacements(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.placementCreate, (e, input) => authorizedPlaceResident(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.residentTaskListForResident, (e, residentId: string) =>
    authorizedListResidentTasksForResident(repos, sessions, clock, senderKeyOf(e), residentId)
  );
  ipcMain.handle(IPC_CHANNELS.residentTaskCreate, (e, input) => authorizedCreateResidentTask(repos, sessions, clock, senderKeyOf(e), input));

  ipcMain.handle(IPC_CHANNELS.assignmentGenerate, (e, input) => authorizedGenerateAssignment(repos, sessions, clock, senderKeyOf(e), input));

  // --- Authentication and account administration (ACCESS-CONTROL.md) ---
  ipcMain.handle(IPC_CHANNELS.authNeedsBootstrap, () => needsBootstrap(repos));
  ipcMain.handle(IPC_CHANNELS.authBootstrapAdmin, (_e, input) => bootstrapFirstAdmin(repos, clock, input));
  ipcMain.handle(IPC_CHANNELS.authLogin, (e, input) => login(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authLogout, (e) => logout(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.authLock, (e) => lock(sessions, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.authUnlock, (e, input) => unlock(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authCurrentSession, (e) => currentSession(repos, sessions, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.authSessionStatus, (e) => sessionStatus(repos, sessions, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.authChangeOwnPassword, (e, input) => changeOwnPassword(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authRecoverWithCode, (_e, input) => recoverWithCode(repos, sessions, clock, input));
  ipcMain.handle(IPC_CHANNELS.authCreateAccount, (e, input) => createAccount(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authSetAccountRoleAndGrants, (e, input) => setAccountRoleAndGrants(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authSetAccountEnabled, (e, input) => setAccountEnabled(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authAdminResetPassword, (e, input) => adminResetPassword(repos, sessions, clock, senderKeyOf(e), input));
  ipcMain.handle(IPC_CHANNELS.authListAccounts, (e) => listAccounts(repos, sessions, clock, senderKeyOf(e)));
  ipcMain.handle(IPC_CHANNELS.authListSecurityEvents, (e) => listSecurityEvents(repos, sessions, clock, senderKeyOf(e)));
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
      // See preload.ts / docs/adr note in electron/build.mjs: sandbox:true
      // cannot resolve this bundled preload's needs and is intentionally
      // left unset here too, for the same reason.
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

  setInterval(() => sessions.sweepIdleSessions(Date.now(), IDLE_LOCK_TIMEOUT_MS), 30_000);
  // Lock on OS session lock/suspend; resume requires reauthentication (ACCESS-CONTROL.md §5).
  powerMonitor.on("lock-screen", () => sessions.lockAll());
  powerMonitor.on("suspend", () => sessions.lockAll());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
