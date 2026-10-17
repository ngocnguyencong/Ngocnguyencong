import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("resets only its checkout's Web cache and tolerates a missing cache", () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), "supastack-e2e-cache-"));
  try {
    mkdirSync(path.join(fixture, "scripts"));
    const script = path.join(fixture, "scripts/reset-e2e-cache.mjs");
    copyFileSync(fileURLToPath(new URL("../scripts/reset-e2e-cache.mjs", import.meta.url)), script);
    const webCache = path.join(fixture, "apps/web/.next");
    const docsCache = path.join(fixture, "apps/docs/.next");
    mkdirSync(webCache, { recursive: true });
    mkdirSync(docsCache, { recursive: true });
    writeFileSync(path.join(webCache, "stale-graph"), "old graph");
    writeFileSync(path.join(docsCache, "keep"), "other app");

    const run = () => spawnSync(process.execPath, [script], { cwd: os.tmpdir(), encoding: "utf8" });
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(webCache)).toBe(false);
    expect(existsSync(path.join(docsCache, "keep"))).toBe(true);
    expect(run().status).toBe(0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
