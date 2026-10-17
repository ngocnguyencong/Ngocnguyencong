import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");
const readScripts = (rel: string) =>
  (JSON.parse(read(rel)) as { scripts?: Record<string, string> }).scripts ?? {};

function envValue(text: string, key: string) {
  return text.match(new RegExp(`^${key}=([^\\r\\n]*)$`, "m"))?.[1].trim();
}

function composeValue(compose: string, key: string) {
  const value = compose.match(new RegExp(`^\\s+${key}:\\s*([^\\r\\n\\s]+)\\s*$`, "m"))?.[1];
  return value?.match(/^\$\{[A-Z_]+:-(.*)\}$/)?.[1] ?? value;
}

const envExample = read(".env.example");
const compose = read("docker-compose.yml");

describe("local setup defaults", () => {
  it("does not track Next-generated environment files that dev and build rewrite", () => {
    const tracked = execFileSync("git", ["ls-files", "apps/*/next-env.d.ts"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(tracked.trim()).toBe("");
  });

  it.each(["web", "docs"])("generates %s route types before a cold typecheck", (app) => {
    expect(readScripts(`apps/${app}/package.json`).typecheck).toBe(
      "next typegen && tsc -p tsconfig.json --noEmit",
    );
  });

  it.each(["test:e2e", "test:e2e:production"])("%s installs its pinned browser", (script) => {
    expect(readScripts("package.json")[script]).toMatch(
      /^playwright install chromium && playwright test/,
    );
  });

  it(".env.example DATABASE_URL matches the docker-compose Postgres credentials", () => {
    const url = envValue(envExample, "DATABASE_URL");
    expect(url).toBeDefined();
    const match = url!.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@[^:/]+:\d+\/(.+)$/);
    expect(match).not.toBeNull();
    const [, user, password, database] = match!;
    expect(user).toBe(composeValue(compose, "POSTGRES_USER"));
    expect(password).toBe(composeValue(compose, "POSTGRES_PASSWORD"));
    expect(database).toBe(composeValue(compose, "POSTGRES_DB"));
  });

  it("drizzle.config.ts falls back to the same DATABASE_URL as .env.example", () => {
    const drizzleConfig = read("packages/db/drizzle.config.ts");
    const fallback = drizzleConfig.match(/postgres:\/\/[^"'\s]+/)?.[0];
    expect(fallback).toBe(envValue(envExample, "DATABASE_URL"));
  });

  it.each([
    ["check", ["lint", "typecheck", "test", "format:check"]],
    ["check:local", ["lint", "typecheck:local", "test", "format:check"]],
    [
      "verify:local",
      [
        "check:local",
        "build",
        "test:e2e",
        "node scripts/reset-e2e-cache.mjs",
        "test:e2e:production",
      ],
    ],
    [
      "verify:desktop",
      ["typecheck:desktop", "turbo run test --filter=@supastack/desktop", "build:desktop"],
    ],
  ])("%s chains its ordered steps through Corepack", (gate, steps) => {
    const scripts = readScripts("package.json");
    const expected = steps.map((step) =>
      /^(?:turbo|node) /.test(step) ? step : `corepack pnpm ${step}`,
    );
    expect(scripts[gate]?.split(/\s*&&\s*/)).toEqual(expected);
  });

  it("keeps the local typecheck desktop-free", () => {
    const scripts = readScripts("package.json");
    expect(scripts["typecheck:local"]).toContain("--filter=!@supastack/desktop");
  });

  it("documents a user-writable Corepack shim for Turbo on Windows", () => {
    const readme = read("README.md");
    expect(readme).toContain('Join-Path $env:LOCALAPPDATA "supastack\\corepack-shims"');
    expect(readme).toContain("corepack enable --install-directory $shimDir");
    expect(readme).toContain('$env:PATH = "$shimDir;$env:PATH"');
  });

  it("dev ports are fixed so web is always :3000 and docs :3001", () => {
    const web = readScripts("apps/web/package.json");
    const docs = readScripts("apps/docs/package.json");
    expect(web.dev).toContain("--port 3000");
    expect(docs.dev).toContain("--port 3001");
    expect(envValue(envExample, "APP_URL")).toContain(":3000");
  });
});
