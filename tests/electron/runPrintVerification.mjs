// Orchestrates the rendered multi-page print verification the same way
// run.mjs orchestrates the IPC boundary test: start Vite, wait for it, run
// the Electron print-verification script against a fresh temp userData
// dir, tear down, propagate the exit code.
//
// Requires `npm run build` (dist-electron/main.cjs + preload.cjs) and
// `npm run rebuild:electron` first. On Linux without a display, run this
// under `xvfb-run -a`.
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

  const userDataDir = mkdtempSync(join(tmpdir(), "tasksheet-print-test-"));
  const exitCode = await new Promise((resolve) => {
    const electronArgs = ["electron", "--no-sandbox", "tests/electron/printVerification.mjs"];
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
