const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const outDir = process.env.SMOKE_OUT_DIR;

// Boots the real app entry point (registers every IPC handler, opens the
// real SQLite store) exactly as `npm run electron` would, then drives its
// own window — this is not a stand-in main process.
require("../dist-electron/main.cjs");

app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 500));
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) throw new Error("main.cjs did not create a window");

  await new Promise((r) => setTimeout(r, 1000));

  async function shot(name) {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, name), image.toPNG());
  }

  async function click(text) {
    await win.webContents.executeJavaScript(`
      (function() {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(${JSON.stringify(text)}));
        btn && btn.click();
        return !!btn;
      })();
    `);
    await new Promise((r) => setTimeout(r, 300));
  }

  async function setValue(id, value) {
    await win.webContents.executeJavaScript(`
      (function() {
        const el = document.getElementById(${JSON.stringify(id)});
        const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })();
    `);
  }

  // 1. First-run bootstrap screen (AC-44).
  await shot("01-create-admin.png");
  await setValue("bootstrap-alias", "admin");
  await setValue("bootstrap-password", "correct horse battery staple");
  await setValue("bootstrap-confirm", "correct horse battery staple");
  await click("Create Administrator");
  await new Promise((r) => setTimeout(r, 500));

  // 2. Recovery code shown exactly once (ACCESS-CONTROL.md §6).
  await shot("02-recovery-code.png");
  await win.webContents.executeJavaScript(`
    (function() {
      const cb = document.querySelector('input[type="checkbox"]');
      cb.click();
    })();
  `);
  await click("Continue to sign in");
  await new Promise((r) => setTimeout(r, 400));

  // 3. Login screen (no resident data rendered before sign-in).
  await shot("03-login.png");
  await setValue("login-alias", "admin");
  await setValue("login-password", "correct horse battery staple");
  await click("Sign in");
  await new Promise((r) => setTimeout(r, 600));

  // 4. Authenticated app shell with identity/role in the header.
  await shot("04-authenticated-dashboard.png");

  await click("Settings");
  await new Promise((r) => setTimeout(r, 300));
  await shot("05-settings-facility.png");

  await click("Users & Access");
  await new Promise((r) => setTimeout(r, 300));
  await shot("06-users-and-access.png");

  // 5. Lock the session (AC-49) and confirm the lock screen appears.
  await click("Lock");
  await new Promise((r) => setTimeout(r, 400));
  await shot("07-locked.png");

  const info = await win.webContents.executeJavaScript(`
    (function() {
      return {
        bodyText: document.body.innerText.slice(0, 300)
      };
    })();
  `);
  fs.writeFileSync(path.join(outDir, "post-lock-body.json"), JSON.stringify(info, null, 2));

  app.quit();
});
