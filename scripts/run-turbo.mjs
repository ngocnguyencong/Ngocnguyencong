import { spawnSync } from "node:child_process";
import { error } from "node:console";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** Avoid Windows cache-write shutdown stalls unless the caller chooses a policy. */
export function turboEnvironment(env, platform) {
  return platform === "win32"
    ? { ...env, TURBO_CACHE: env.TURBO_CACHE ?? "local:r,remote:r" }
    : { ...env };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = spawnSync(process.execPath, [require.resolve("turbo"), ...process.argv.slice(2)], {
    env: turboEnvironment(process.env, process.platform),
    stdio: "inherit",
  });
  if (result.error) error(result.error.message);
  process.exitCode = result.status ?? 1;
}
