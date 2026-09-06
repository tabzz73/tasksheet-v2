// Production-like Electron IPC boundary test. Run via the real `electron`
// binary (not vitest — vitest cannot import the 'electron' module), against
// the actual built dist-electron/main.cjs and preload.cjs, through the real
// contextBridge/ipcRenderer.invoke path. See package.json's
// `test:electron` script.
//
// Usage: SMOKE_USERDATA=<tmp dir> electron tests/electron/ipcBoundary.mjs
// Exits 0 with "ALL PASSED" on success, exits 1 and prints failures otherwise.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const electron = require("electron");
const { app, BrowserWindow, ipcMain } = electron;

const userDataDir = process.env.SMOKE_USERDATA;
if (!userDataDir) {
  console.error("SMOKE_USERDATA env var is required");
  process.exit(1);
}
app.setPath("userData", userDataDir);

// Capture every registered handler (channel -> listener) as main.cjs
// registers them for real, so "forged payload" tests below can invoke the
// exact production handler function directly with a synthetic event,
// without a second reimplementation of the authorization logic.
const capturedHandlers = new Map();
const originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => {
  capturedHandlers.set(channel, listener);
  return originalHandle(channel, listener);
};

require("../../dist-electron/main.cjs");

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`);
}

function openWindow() {
  return new BrowserWindow({
    show: false,
    width: 1024,
    height: 768,
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

app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 300));

  // --- Fixture: two independent renderer windows (two real webContents/sender ids) ---
  const winA = openWindow();
  const winB = openWindow();
  await loadReal(winA);
  await loadReal(winB);

  // === 1. Unauthenticated requests are rejected on a genuinely fresh sender ===
  const preLoginRead = await callApi(winA, `window.tasksheet.shifts.list()`);
  record("unauthenticated read is rejected before any login", preLoginRead.kind === "unauthenticated", JSON.stringify(preLoginRead));

  const preLoginWrite = await callApi(
    winA,
    `window.tasksheet.residents.create({ firstName: "A", lastName: "B" })`
  );
  record("unauthenticated mutation is rejected before any login", preLoginWrite.kind === "unauthenticated", JSON.stringify(preLoginWrite));

  // === Bootstrap + admin login on winA ===
  const bootstrap = await callApi(
    winA,
    `window.tasksheet.auth.bootstrapAdmin({ alias: "admin", password: "correct horse battery staple" })`
  );
  record("bootstrap succeeds through the real preload path", bootstrap.kind === "success", JSON.stringify(bootstrap).slice(0, 200));

  const adminLogin = await callApi(
    winA,
    `window.tasksheet.auth.login({ alias: "admin", password: "correct horse battery staple" })`
  );
  record("admin login succeeds through the real preload path", adminLogin.kind === "success");

  // === 2. Sender/frame binding: winB has NOT logged in, so it must still be denied ===
  // even though the same OS process now has an authenticated session on winA.
  const winBStillUnauth = await callApi(winB, `window.tasksheet.shifts.list()`);
  record(
    "a second, never-logged-in window is denied even while another window in the same process is authenticated (sender binding)",
    winBStillUnauth.kind === "unauthenticated",
    JSON.stringify(winBStillUnauth)
  );

  // === Fixtures the rest of the test needs, created by the real admin session ===
  const facilityResult = await callApi(
    winA,
    `window.tasksheet.facility.save({ facilityId: "facility-1", name: "Fictional Pines", addressLine1: "1 Fictional Way", addressLine2: null, mainPhone: "555-0100", nursingPhone: null, fax: null, timeZone: "America/Denver", weekStart: 1, escalationThreshold: 3 })`
  );
  record("admin can save facility settings", facilityResult.kind === "success");

  const shiftResult = await callApi(
    winA,
    `window.tasksheet.shifts.create({ shortCode: "D1", name: "Day HCA", role: "HCA", startTime: "0700", endTime: "1500" })`
  );
  record("admin can create a shift", shiftResult.kind === "success", JSON.stringify(shiftResult).slice(0, 200));
  const shiftId = shiftResult.kind === "success" ? shiftResult.value.id : null;

  const viewerCreate = await callApi(
    winA,
    `window.tasksheet.auth.createAccount({ alias: "viewer1", password: "viewer starting password 1", role: "Viewer", grants: [] })`
  );
  record("admin can create a Viewer account", viewerCreate.kind === "success");

  const editorCreate = await callApi(
    winA,
    `window.tasksheet.auth.createAccount({ alias: "editor1", password: "editor starting password 1", role: "Editor", grants: [] })`
  );
  record("admin can create an Editor account", editorCreate.kind === "success");
  const editorId = editorCreate.kind === "success" ? editorCreate.value.id : null;

  // === 3. Viewer cannot mutate, through the real IPC path, on its own window ===
  const winC = openWindow();
  await loadReal(winC);
  const viewerLogin = await callApi(winC, `window.tasksheet.auth.login({ alias: "viewer1", password: "viewer starting password 1" })`);
  record("viewer login succeeds", viewerLogin.kind === "success");

  const viewerMutation = await callApi(winC, `window.tasksheet.residents.create({ firstName: "X", lastName: "Y" })`);
  record("Viewer mutation is rejected through the real IPC path", viewerMutation.kind === "forbidden", JSON.stringify(viewerMutation));

  const viewerRead = await callApi(winC, `window.tasksheet.shifts.list()`);
  record("Viewer read/list still succeeds (view+print allowed to every role)", viewerRead.kind === "success");

  const viewerGenerate = await callApi(
    winC,
    `window.tasksheet.assignment.generate({ date: "2026-09-05", shiftId: ${JSON.stringify(shiftId)} })`
  );
  record("Viewer can generate/preview an assignment document", viewerGenerate.kind === "success");

  // === 4. Editor forbidden action (no grant) through the real IPC path ===
  const winD = openWindow();
  await loadReal(winD);
  await callApi(winD, `window.tasksheet.auth.login({ alias: "editor1", password: "editor starting password 1" })`);

  const editorDeactivate = await callApi(winD, `window.tasksheet.shifts.deactivate({ shiftId: ${JSON.stringify(shiftId)} })`);
  record("Editor without the shift.deactivate grant is forbidden, through the real IPC path", editorDeactivate.kind === "forbidden");

  const editorCreateResident = await callApi(winD, `window.tasksheet.residents.create({ firstName: "Fictional", lastName: "Resident" })`);
  record("Editor's default-granted capability (resident.create) still succeeds", editorCreateResident.kind === "success");

  // === 5. Forged/injected payload fields never change the authorization outcome ===
  // Directly invoke the REAL captured `shift:deactivate` handler (the exact
  // function registered by dist-electron/main.cjs) with a synthetic event
  // whose sender.id is winD's real webContents id, but whose payload carries
  // spoofed identity-looking fields no legitimate client would send.
  const shiftDeactivateHandler = capturedHandlers.get("shift:deactivate");
  const forgedEvent = { sender: { id: winD.webContents.id } };
  const forgedResult = await shiftDeactivateHandler(forgedEvent, {
    shiftId,
    accountId: "admin-account-id",
    role: "Administrator",
    authRevision: 999,
    grants: ["accounts.manage"]
  });
  record(
    "a payload forging accountId/role/grants is still denied — authorization derives only from event.sender.id",
    forgedResult.kind === "forbidden",
    JSON.stringify(forgedResult)
  );

  // Same handler, but with a sender id that has never authenticated at all (spoofed webContents id).
  const spoofedSenderResult = await shiftDeactivateHandler({ sender: { id: 999999 } }, { shiftId });
  record(
    "an arbitrary/spoofed sender id with no real session is rejected as unauthenticated",
    spoofedSenderResult.kind === "unauthenticated",
    JSON.stringify(spoofedSenderResult)
  );

  // The SAME real admin sender id, called directly against the captured
  // handler (bypassing contextBridge entirely), gets the SAME authorized
  // result as the normal path did above — proving there is no weaker
  // "internal" check a modified preload/renderer could exploit.
  const secondShift = await callApi(
    winA,
    `window.tasksheet.shifts.create({ shortCode: "D2", name: "Day HCA 2", role: "HCA", startTime: "0700", endTime: "1500" })`
  );
  const directAdminDeactivate = await shiftDeactivateHandler({ sender: { id: winA.webContents.id } }, { shiftId: secondShift.value.id });
  record("the real admin sender id succeeds even called directly against the captured handler", directAdminDeactivate.kind === "success");

  // === 6. Revoked session is rejected on its very next request ===
  const grantResult = await callApi(
    winA,
    `window.tasksheet.auth.setAccountRoleAndGrants({ targetAccountId: ${JSON.stringify(editorId)}, role: "Editor", grants: ["shift.deactivate"] })`
  );
  record("admin can grant shift.deactivate to the editor", grantResult.kind === "success");

  // Granting revokes the editor's outstanding session (winD) — prove the
  // very next request from that still-open window is now unauthenticated,
  // not silently still-authorized from a cached session object.
  const staleAfterGrant = await callApi(winD, `window.tasksheet.shifts.deactivate({ shiftId: ${JSON.stringify(shiftId)} })`);
  record("a role/grant change immediately invalidates the editor's open session (no replay)", staleAfterGrant.kind === "unauthenticated");

  const editorReLogin = await callApi(winD, `window.tasksheet.auth.login({ alias: "editor1", password: "editor starting password 1" })`);
  record("editor can log back in after the grant", editorReLogin.kind === "success");

  const editorDeactivateWithGrant = await callApi(winD, `window.tasksheet.shifts.deactivate({ shiftId: ${JSON.stringify(shiftId)} })`);
  record("editor with the exact grant can now deactivate the shift", editorDeactivateWithGrant.kind === "success");

  const revokeResult = await callApi(
    winA,
    `window.tasksheet.auth.setAccountRoleAndGrants({ targetAccountId: ${JSON.stringify(editorId)}, role: "Editor", grants: [] })`
  );
  record("admin can revoke the grant again", revokeResult.kind === "success");

  await callApi(winD, `window.tasksheet.auth.login({ alias: "editor1", password: "editor starting password 1" })`);
  const deniedAfterRevoke = await callApi(winD, `window.tasksheet.shifts.deactivate({ shiftId: ${JSON.stringify(secondShift.value.id)} })`);
  record("after the grant is revoked, the same capability is denied again on the next request", deniedAfterRevoke.kind === "forbidden");

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
