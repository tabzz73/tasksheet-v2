import { build } from "esbuild";

/**
 * Bundles the main process and preload script into single dependency-free
 * CommonJS files. Bundling the preload script specifically is required:
 * Electron's preload module loader does not resolve plain relative
 * `require("../src/...")` calls the way Node does for a normal script
 * (confirmed via `preload-error` during manual smoke testing — see
 * ADR-0001 discussion), so it must not depend on any file outside itself
 * at runtime. `electron` and the native `better-sqlite3` binding stay
 * external rather than bundled.
 */
const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
  logLevel: "info"
};

await build({ ...shared, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.cjs" });
await build({ ...shared, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.cjs" });
