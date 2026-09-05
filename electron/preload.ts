import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../src/shared/ipc.js";
import type { TasksheetApi } from "../src/shared/ipc.js";

/**
 * The renderer's entire persistence surface. Every method maps 1:1 to a
 * single allow-listed main-process IPC channel that runs a validated
 * application use case — no generic invoke passthrough is exposed.
 */
const api: TasksheetApi = {
  facility: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.facilityGet),
    save: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitySave, input)
  },
  shifts: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.shiftList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.shiftCreate, input)
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
  }
};

contextBridge.exposeInMainWorld("tasksheet", api);
