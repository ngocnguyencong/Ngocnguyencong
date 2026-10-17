import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/run-turbo.mjs", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("portable Turbo launcher", () => {
  it("runs the installed CLI without a globally installed Turbo", () => {
    const result = spawnSync(process.execPath, [script, "--version"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("2.10.12");
  });

  it("preserves a failed Turbo command's exit status", () => {
    const result = spawnSync(process.execPath, [script, "not-a-turbo-command"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find task");
  });

  it("defaults Windows to read-only cache while retaining explicit overrides", async () => {
    const { turboEnvironment } = await import("../scripts/run-turbo.mjs");
    expect(turboEnvironment({ PATH: "local-tools" }, "win32")).toEqual({
      PATH: "local-tools",
      TURBO_CACHE: "local:r,remote:r",
    });
    expect(turboEnvironment({ TURBO_CACHE: "local:rw" }, "win32")).toEqual({
      TURBO_CACHE: "local:rw",
    });
    expect(turboEnvironment({ PATH: "local-tools" }, "linux")).toEqual({ PATH: "local-tools" });
    expect(turboEnvironment({ PATH: "local-tools" }, "darwin")).toEqual({ PATH: "local-tools" });
  });
});
