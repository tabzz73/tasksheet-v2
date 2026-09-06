import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../src/shared/ipc.js";
import type { TasksheetApi } from "../src/shared/ipc.js";

/**
 * The renderer's entire persistence/auth surface. Every method maps 1:1 to
 * a single allow-listed main-process IPC channel that runs a validated,
 * authorized application use case — no generic invoke passthrough is
 * exposed, and no session token or credential is ever passed as an
 * argument here: the main process binds the session to this renderer's
 * own `event.sender.id` (see electron/main.ts), which the preload script
 * has no ability to forge.
 */
const api: TasksheetApi = {
  facility: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.facilityGet),
    save: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitySave, input)
  },
  shifts: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.shiftList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.shiftCreate, input),
    deactivate: (input) => ipcRenderer.invoke(IPC_CHANNELS.shiftDeactivate, input)
  },
  rooms: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.roomList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.roomCreate, input)
  },
  beds: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.bedList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.bedCreate, input)
  },
  residents: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.residentList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.residentCreate, input)
  },
  placements: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.placementList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.placementCreate, input)
  },
  residentTasks: {
    listForResident: (residentId) => ipcRenderer.invoke(IPC_CHANNELS.residentTaskListForResident, residentId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.residentTaskCreate, input)
  },
  assignment: {
    generate: (input) => ipcRenderer.invoke(IPC_CHANNELS.assignmentGenerate, input)
  },
  auth: {
    needsBootstrap: () => ipcRenderer.invoke(IPC_CHANNELS.authNeedsBootstrap),
    bootstrapAdmin: (input) => ipcRenderer.invoke(IPC_CHANNELS.authBootstrapAdmin, input),
    login: (input) => ipcRenderer.invoke(IPC_CHANNELS.authLogin, input),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.authLogout),
    lock: () => ipcRenderer.invoke(IPC_CHANNELS.authLock),
    unlock: (input) => ipcRenderer.invoke(IPC_CHANNELS.authUnlock, input),
    currentSession: () => ipcRenderer.invoke(IPC_CHANNELS.authCurrentSession),
    sessionStatus: () => ipcRenderer.invoke(IPC_CHANNELS.authSessionStatus),
    changeOwnPassword: (input) => ipcRenderer.invoke(IPC_CHANNELS.authChangeOwnPassword, input),
    recoverWithCode: (input) => ipcRenderer.invoke(IPC_CHANNELS.authRecoverWithCode, input),
    createAccount: (input) => ipcRenderer.invoke(IPC_CHANNELS.authCreateAccount, input),
    setAccountRoleAndGrants: (input) => ipcRenderer.invoke(IPC_CHANNELS.authSetAccountRoleAndGrants, input),
    setAccountEnabled: (input) => ipcRenderer.invoke(IPC_CHANNELS.authSetAccountEnabled, input),
    adminResetPassword: (input) => ipcRenderer.invoke(IPC_CHANNELS.authAdminResetPassword, input),
    listAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.authListAccounts),
    listSecurityEvents: () => ipcRenderer.invoke(IPC_CHANNELS.authListSecurityEvents)
  }
};

contextBridge.exposeInMainWorld("tasksheet", api);
