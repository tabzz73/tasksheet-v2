// Orchestrates the production-like Electron IPC boundary test:
// 1. Starts the Vite dev server (dist-electron/main.cjs loads it in dev mode).
// 2. Waits for it to answer.
// 3. Runs `electron tests/electron/ipcBoundary.mjs` against a fresh temp userData dir.
// 4. Tears down Vite and exits with the Electron test's exit code.
//
// Requires `npm run build` to have produced dist-electron/main.cjs and
// preload.cjs first, and better-sqlite3 rebuilt for Electron's ABI
// (`npm run rebuild:electron`). On Linux without a display, run this under
// `xvfb-run -a`.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function waitForServer(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
          else setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

const vite = spawn("npx", ["vite", "--port", "5173"], { stdio: "ignore" });

try {
  await waitForServer("http://localhost:5173/", 20_000);

  const userDataDir = mkdtempSync(join(tmpdir(), "tasksheet-ipc-test-"));
  const exitCode = await new Promise((resolve) => {
    const electronArgs = ["electron", "--no-sandbox", "tests/electron/ipcBoundary.mjs"];
    const child = spawn("npx", electronArgs, {
      stdio: "inherit",
      env: { ...process.env, SMOKE_USERDATA: userDataDir }
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
  rmSync(userDataDir, { recursive: true, force: true });
  process.exitCode = exitCode;
} finally {
  vite.kill("SIGKILL");
}
