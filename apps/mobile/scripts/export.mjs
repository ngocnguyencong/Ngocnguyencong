import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const expoCli = require.resolve("expo/bin/cli");
const result = spawnSync(process.execPath, [expoCli, "export"], {
  env: {
    ...process.env,
    CI: process.env.CI ?? "true",
    EXPO_NO_TELEMETRY: "1",
    EXPO_OFFLINE: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
