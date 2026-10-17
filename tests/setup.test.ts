import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  INPUT_ENDED,
  normalizeAnswer,
  parseFlags,
  resolveMode,
  runWizard,
  satisfiesNodeRange,
} from "../scripts/setup.mjs";

const fixtures: string[] = [];
const template = [
  "APP_ENV=local",
  "AUTH_SECRET=replace-with-auth-secret",
  "SCHEDULER_TICK_SECRET=",
  "CREDENTIAL_ENCRYPTION_KEY=replace-with-base64-key",
  "EMAIL_PROVIDER=local",
  "",
].join("\n");
const authSecret = "a".repeat(64);
const tickSecret = "b".repeat(64);
const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const validEnvironment = [
  `AUTH_SECRET='${authSecret}'`,
  `SCHEDULER_TICK_SECRET=${tickSecret}`,
  `CREDENTIAL_ENCRYPTION_KEY=${encryptionKey}`,
  "EMAIL_PROVIDER=smtp",
  "",
].join("\n");

function fixture(env?: string, engines = ">=22.0.0"): string {
  const root = mkdtempSync(path.join(tmpdir(), "supastack-setup-test-"));
  fixtures.push(root);
  mkdirSync(path.join(root, "apps/web"), { recursive: true });
  writeFileSync(path.join(root, ".env.example"), template);
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        engines: { node: engines },
        name: "setup-fixture",
        packageManager: "pnpm@11.19.0",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
  if (env !== undefined) {
    writeFileSync(path.join(root, ".env"), env);
    writeFileSync(path.join(root, "apps/web/.env.local"), env);
  }
  return root;
}

const rootEnv = (root: string) => path.join(root, ".env");
const webEnv = (root: string) => path.join(root, "apps/web/.env.local");

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

const script = path.resolve("scripts/setup.mjs");

/** Spawn the CLI in a fixture checkout — piped stdin makes it a non-TTY run. */
function run(args: string[], cwd: string) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    input: "",
    timeout: 60_000,
  });
}

/** Whether this host can actually run `corepack pnpm` (CI may lack Corepack). */
const COREPACK_OK = (() => {
  const probe =
    process.platform === "win32"
      ? spawnSync("corepack --version", { encoding: "utf8", shell: true, timeout: 30_000 })
      : spawnSync("corepack", ["--version"], { encoding: "utf8", timeout: 30_000 });
  return probe.status === 0 && !probe.error;
})();

interface FakeIo {
  asked: { fallback: boolean; question: string }[];
  calls: string[];
  errs: string[];
  io: {
    ask?: (question: string, fallback: boolean) => Promise<boolean | typeof INPUT_ENDED>;
    fail: (line: string) => void;
    print: (line: string) => void;
    probe: (argv: string[]) => { out: string; status: number };
    run: (argv: string[]) => number;
  };
  out: string[];
}

function fakeIo({
  answers = [] as boolean[],
  probe = { out: "0.35.0", status: 0 },
  run = () => 0,
} = {}): FakeIo {
  const asked: FakeIo["asked"] = [];
  const calls: string[] = [];
  const errs: string[] = [];
  const out: string[] = [];
  return {
    asked,
    calls,
    errs,
    io: {
      ask: async (question, fallback) => {
        asked.push({ fallback, question });
        return answers.length > 0 ? answers.shift()! : fallback;
      },
      fail: (line) => void errs.push(line),
      print: (line) => void out.push(line),
      probe: (argv) => {
        calls.push(`probe ${argv.join(" ")}`);
        return probe;
      },
      run: (argv) => {
        calls.push(`run ${argv.join(" ")}`);
        return run(argv);
      },
    },
    out,
  };
}

describe("flag and mode parsing", () => {
  it("recognizes every documented flag", () => {
    expect(parseFlags(["--help"])).toMatchObject({ help: true, unknown: [] });
    expect(parseFlags(["-h"])).toMatchObject({ help: true, unknown: [] });
    for (const flag of ["--check", "--dry-run"])
      expect(parseFlags([flag])).toMatchObject({ check: true, unknown: [] });
    for (const flag of ["-y", "--yes", "--non-interactive"])
      expect(parseFlags([flag])).toMatchObject({ unknown: [], yes: true });
    expect(parseFlags(["--skip-migrate"])).toMatchObject({ skipMigrate: true, unknown: [] });
  });

  it("collects unknown flags and ignores a forwarded bare `--`", () => {
    expect(parseFlags(["--bogus", "-z", "--check"])).toMatchObject({
      check: true,
      unknown: ["--bogus", "-z"],
    });
    expect(parseFlags(["--", "--yes"])).toMatchObject({ unknown: [], yes: true });
    expect(parseFlags([])).toMatchObject({
      check: false,
      help: false,
      skipMigrate: false,
      unknown: [],
      yes: false,
    });
  });

  it("resolves modes: help and check win, non-TTY falls back to defaults", () => {
    expect(resolveMode({ flags: parseFlags(["--help"]), stdinIsTTY: true })).toBe("help");
    expect(resolveMode({ flags: parseFlags(["--check"]), stdinIsTTY: true })).toBe("check");
    expect(resolveMode({ flags: parseFlags(["--yes"]), stdinIsTTY: true })).toBe("defaults");
    expect(resolveMode({ flags: parseFlags([]), stdinIsTTY: false })).toBe("defaults");
    expect(resolveMode({ flags: parseFlags([]), stdinIsTTY: true })).toBe("interactive");
    // --yes on a real TTY still picks defaults; a TTY can keep prompting flags.
    expect(resolveMode({ flags: parseFlags(["--yes"]), stdinIsTTY: false })).toBe("defaults");
  });
});

describe("pure helpers", () => {
  it("satisfiesNodeRange compares the `>=` floor numerically", () => {
    expect(satisfiesNodeRange("v22.0.0", ">=22.0.0")).toBe(true);
    expect(satisfiesNodeRange("v24.20.0", ">=22.0.0")).toBe(true);
    expect(satisfiesNodeRange("v21.9.9", ">=22.0.0")).toBe(false);
    expect(satisfiesNodeRange("22.0.0", ">=22.0.0")).toBe(true);
    // No `>=` bound or unparseable version → report, never block.
    expect(satisfiesNodeRange("v20.0.0", "^18 || >=22.0.0")).toBe(false);
    expect(satisfiesNodeRange("v20.0.0", "lts/*")).toBe(true);
  });

  it("normalizeAnswer maps y/n answers and honors defaults", () => {
    expect(normalizeAnswer("", true)).toBe(true);
    expect(normalizeAnswer("", false)).toBe(false);
    expect(normalizeAnswer("  YES ", false)).toBe(true);
    expect(normalizeAnswer("n", true)).toBe(false);
    expect(normalizeAnswer("maybe", true)).toBe(true);
    expect(normalizeAnswer("maybe", false)).toBe(false);
    // Non-string input (never throws) falls back — EOF itself is intercepted
    // upstream as INPUT_ENDED, never coerced through this helper.
    expect(normalizeAnswer(null, true)).toBe(true);
    expect(normalizeAnswer(undefined, false)).toBe(false);
    expect(normalizeAnswer(42, true)).toBe(true);
  });
});

describe("runWizard with an injected io", () => {
  it("interactive: installs on accept, bootstraps env, skips declined migrate", async () => {
    const root = fixture();
    const fake = fakeIo({ answers: [true, false] });
    const code = await runWizard(root, { mode: "interactive" }, fake.io);
    expect(code).toBe(0);
    expect(fake.calls).toContain("run corepack pnpm install");
    expect(fake.calls.some((c) => c.includes("db:migrate"))).toBe(false);
    expect(fake.asked).toHaveLength(2);
    expect(existsSync(rootEnv(root))).toBe(true);
    expect(existsSync(webEnv(root))).toBe(true);
    expect(parseEnv(readFileSync(rootEnv(root), "utf8")).AUTH_SECRET).toMatch(/^[a-f0-9]{64}$/);
    // Next-steps summary points at the dev command, local URL, and checklist.
    expect(fake.out.join("\n")).toContain("corepack pnpm --filter @supastack/web dev");
    expect(fake.out.join("\n")).toContain("http://localhost:3000");
    expect(fake.out.join("\n")).toContain("http://localhost:3000/setup");
  });

  it("interactive: a failed migrate prints the Postgres remediation and exits 1", async () => {
    const root = fixture();
    const fake = fakeIo({
      answers: [true, true],
      run: (argv: string[]) => (argv[2] === "install" ? 0 : 1),
    });
    const code = await runWizard(root, { mode: "interactive" }, fake.io);
    expect(code).toBe(1);
    expect(fake.calls.some((c) => c.includes("db:migrate"))).toBe(true);
    expect(fake.errs.join("\n")).toContain("docker compose up -d postgres");
  });

  it("defaults: bootstraps env only — never installs, never migrates, never asks", async () => {
    const root = fixture();
    const fake = fakeIo();
    const code = await runWizard(root, { mode: "defaults" }, fake.io);
    expect(code).toBe(0);
    expect(fake.asked).toHaveLength(0);
    expect(fake.calls).toEqual(["probe corepack --version"]);
    expect(fake.out.join("\n")).toMatch(/non-interactive|SKIP/i);
    expect(existsSync(rootEnv(root))).toBe(true);
    expect(existsSync(webEnv(root))).toBe(true);
    expect(existsSync(path.join(root, "node_modules"))).toBe(false);
  });

  it("--skip-migrate suppresses the migrate prompt in interactive mode", async () => {
    const root = fixture();
    mkdirSync(path.join(root, "node_modules"), { recursive: true });
    const fake = fakeIo();
    const code = await runWizard(root, { mode: "interactive", skipMigrate: true }, fake.io);
    expect(code).toBe(0);
    expect(fake.asked).toHaveLength(0);
    expect(fake.out.join("\n")).toContain("--skip-migrate");
    expect(fake.calls.some((c) => c.includes("db:migrate"))).toBe(false);
  });

  it("dies on a missing corepack before touching env files", async () => {
    const root = fixture();
    const fake = fakeIo({ probe: { out: "", status: 1 } });
    const code = await runWizard(root, { mode: "interactive" }, fake.io);
    expect(code).toBe(1);
    expect(fake.errs.join("\n")).toMatch(/corepack/i);
    expect(existsSync(rootEnv(root))).toBe(false);
  });

  it("check mode reports env problems, writes nothing, and keeps checking", async () => {
    const root = fixture();
    const fake = fakeIo();
    const code = await runWizard(root, { mode: "check" }, fake.io);
    expect(code).toBe(1);
    expect(fake.errs.join("\n")).toMatch(/\.env.*missing/i);
    // The failure summary goes to stderr with the other FAIL lines.
    expect(fake.errs.join("\n")).toMatch(/nothing was written/i);
    expect(existsSync(rootEnv(root))).toBe(false);
    expect(existsSync(webEnv(root))).toBe(false);
    expect(fake.calls.some((c) => c.startsWith("run "))).toBe(false);
  });

  it("check mode passes a valid fixture and never prompts or runs commands", async () => {
    const root = fixture(validEnvironment);
    const fake = fakeIo();
    const code = await runWizard(root, { mode: "check" }, fake.io);
    expect(code).toBe(0);
    expect(fake.out.join("\n")).toMatch(/all checks green/i);
    expect(fake.asked).toHaveLength(0);
    expect(fake.calls).toEqual(["probe corepack --version"]);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(validEnvironment);
  });

  it("aborts with a clear FAIL when stdin ends at the install prompt", async () => {
    const root = fixture();
    const fake = fakeIo();
    fake.io.ask = async () => INPUT_ENDED;
    const code = await runWizard(root, { mode: "interactive" }, fake.io);
    expect(code).toBe(1);
    expect(fake.errs.join("\n")).toMatch(/input ended.*aborted/i);
    // EOF must never fall through to the prompt's `true` default → no install.
    expect(fake.calls.some((c) => c.startsWith("run "))).toBe(false);
    expect(existsSync(rootEnv(root))).toBe(false);
  });

  it("aborts with a clear FAIL when stdin ends at the migrate prompt", async () => {
    const root = fixture(validEnvironment);
    mkdirSync(path.join(root, "node_modules"), { recursive: true });
    const fake = fakeIo();
    fake.io.ask = async () => INPUT_ENDED;
    const code = await runWizard(root, { mode: "interactive" }, fake.io);
    expect(code).toBe(1);
    expect(fake.errs.join("\n")).toMatch(/input ended.*aborted/i);
    expect(fake.calls.some((c) => c.includes("db:migrate"))).toBe(false);
    // The already-valid env files were left untouched.
    expect(readFileSync(rootEnv(root), "utf8")).toBe(validEnvironment);
  });

  it("points a broken checkout (no .env.example) at the repository root", async () => {
    const root = fixture();
    rmSync(path.join(root, ".env.example"));
    const fake = fakeIo();
    const code = await runWizard(root, { mode: "defaults" }, fake.io);
    expect(code).toBe(1);
    expect(fake.errs.join("\n")).toMatch(/\.env\.example/);
    expect(fake.errs.join("\n")).toMatch(/repository root/);
    expect(fake.errs.join("\n")).not.toMatch(/named (?:file or )?key\(s\)/);
  });

  it("keeps the named-key remedy for invalid existing secrets", async () => {
    const bad = validEnvironment.replace(encryptionKey, "not-a-valid-key");
    const root = fixture(bad);
    const fake = fakeIo();
    const code = await runWizard(root, { mode: "defaults" }, fake.io);
    expect(code).toBe(1);
    expect(fake.errs.join("\n")).toMatch(/CREDENTIAL_ENCRYPTION_KEY/);
    expect(fake.errs.join("\n")).toMatch(/named file or key\(s\)/);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(bad);
  });
});

describe("spawned CLI on fixture checkouts", { timeout: 30_000 }, () => {
  it("--help prints usage and writes nothing", () => {
    const root = fixture();
    const result = run(["--help"], root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("--check");
    expect(result.stdout).toContain("--yes");
    expect(existsSync(rootEnv(root))).toBe(false);
  });

  it("unknown flags exit 1 with a remediation line and no writes", () => {
    const root = fixture();
    const result = run(["--bogus"], root);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/unknown flag/i);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Usage:");
    expect(existsSync(rootEnv(root))).toBe(false);
  });

  it("--check passes a valid fixture without writing (when corepack exists)", () => {
    const root = fixture(validEnvironment);
    const result = run(["--check"], root);
    expect(result.status).toBe(COREPACK_OK ? 0 : 1);
    if (COREPACK_OK) expect(`${result.stdout}\n${result.stderr}`).toContain("PASS:");
    expect(readFileSync(rootEnv(root), "utf8")).toBe(validEnvironment);
    expect(readFileSync(webEnv(root), "utf8")).toBe(validEnvironment);
    expect(existsSync(path.join(root, "node_modules"))).toBe(false);
  });

  it("--check fails on missing env files without creating them", () => {
    const root = fixture();
    const result = run(["--check"], root);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/\.env/i);
    expect(existsSync(rootEnv(root))).toBe(false);
    expect(existsSync(webEnv(root))).toBe(false);
  });

  it("non-interactive stdin logs the defaults note and bootstraps only env", () => {
    const root = fixture();
    const result = run([], root);
    expect(result.stdout).toMatch(/non-interactive|safe defaults/i);
    expect(result.status).toBe(COREPACK_OK ? 0 : 1);
    if (result.status === 0) {
      const values = parseEnv(readFileSync(rootEnv(root), "utf8"));
      expect(values.AUTH_SECRET).toMatch(/^[a-f0-9]{64}$/);
      expect(values.CREDENTIAL_ENCRYPTION_KEY).toMatch(/^[A-Za-z0-9+/]{43}=$/);
      expect(readFileSync(webEnv(root), "utf8")).toBe(readFileSync(rootEnv(root), "utf8"));
      expect(existsSync(path.join(root, "node_modules"))).toBe(false);
    }
  });

  it("--yes on a fresh fixture writes only the two env files", () => {
    const root = fixture();
    const pkgBefore = readFileSync(path.join(root, "package.json"), "utf8");
    const result = run(["--yes"], root);
    expect(result.status).toBe(COREPACK_OK ? 0 : 1);
    if (result.status === 0) {
      expect(existsSync(rootEnv(root))).toBe(true);
      expect(existsSync(webEnv(root))).toBe(true);
      expect(existsSync(path.join(root, "node_modules"))).toBe(false);
      expect(readFileSync(path.join(root, "package.json"), "utf8")).toBe(pkgBefore);
    }
  });

  it("dies on an unsatisfiable engines range before writing env files", () => {
    const root = fixture(undefined, ">=99.0.0");
    const result = run(["--yes"], root);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/engines/i);
    expect(existsSync(rootEnv(root))).toBe(false);
  });

  it("exits 1 on an invalid existing secret and never prints its value", () => {
    const bad = validEnvironment.replace(encryptionKey, "not-a-valid-key");
    const root = fixture(bad);
    const result = run(["--yes"], root);
    expect(result.status).toBe(1);
    if (COREPACK_OK) {
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output).toContain("CREDENTIAL_ENCRYPTION_KEY");
      expect(output).not.toContain("not-a-valid-key");
      expect(output).not.toContain(authSecret);
    }
    expect(readFileSync(rootEnv(root), "utf8")).toBe(bad);
    expect(readFileSync(webEnv(root), "utf8")).toBe(bad);
  });
});
