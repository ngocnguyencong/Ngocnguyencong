#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { error, log } from "node:console";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { setupEnvironment } from "./setup-env.mjs";

/**
 * Guided first-run setup (`corepack pnpm setup`, or `node scripts/setup.mjs`
 * when pnpm is not on PATH yet). Zero-dependency like `setup-env.mjs` — the
 * env bootstrap itself is delegated to `setupEnvironment` so both entry
 * points share one secrets contract (never overwritten, never printed).
 *
 * The wizard is safe for CI: `--check`/`--dry-run` validate tools and env
 * files without writing, `--yes`/non-TTY stdin accept safe defaults
 * (bootstrap env files only), and every spawned command is a fixed literal
 * `corepack pnpm …` invocation — no shell-specific syntax, no system tools
 * installed, no git state touched.
 */

const COREPACK = "corepack";
const INSTALL_ARGV = Object.freeze([COREPACK, "pnpm", "install"]);
const MIGRATE_ARGV = Object.freeze([COREPACK, "pnpm", "--filter", "@supastack/db", "db:migrate"]);
const MIGRATE_HINT =
  "start Postgres with `docker compose up -d postgres`, then retry `corepack pnpm --filter @supastack/db db:migrate`";

/**
 * `io.ask` returns this when stdin ends mid-question (Ctrl+D / piped input
 * that ran out) instead of answering. It must never be coerced into the
 * question's fallback — the install prompt's fallback is `true`, so a
 * blanket "no answer → default" rule would silently run `pnpm install` on
 * EOF. runWizard aborts on the sentinel instead.
 */
export const INPUT_ENDED = Symbol("setup.input-ended");

const USAGE = `Usage: node scripts/setup.mjs [flags]   (or: corepack pnpm setup -- <flags>)

Interactive guided setup for a fresh checkout: preflight checks, env
bootstrap, optional dependency install, optional database migrations.

Flags:
  --check, --dry-run          validate tools and env files; write nothing
  -y, --yes, --non-interactive
                              accept safe defaults — run the env bootstrap,
                              skip dependency install and migrations
  --skip-migrate              never offer the database migration step
  -h, --help                  show this help

Non-interactive shells (piped stdin, CI) behave as --yes automatically and
log a line saying so. Prompts show their default as [Y/n] or [y/N].
Exit codes: 0 ok, 1 on a failed step — the last line names the remediation.`;

/** Parse argv into flags; unknown args are collected, never thrown away. */
export function parseFlags(argv) {
  const flags = { check: false, help: false, skipMigrate: false, unknown: [], yes: false };
  for (const arg of argv) {
    if (arg === "--") continue; // forwarded verbatim by `pnpm run setup -- …`
    switch (arg) {
      case "-h":
      case "--help":
        flags.help = true;
        break;
      case "--check":
      case "--dry-run":
        flags.check = true;
        break;
      case "-y":
      case "--yes":
      case "--non-interactive":
        flags.yes = true;
        break;
      case "--skip-migrate":
        flags.skipMigrate = true;
        break;
      default:
        flags.unknown.push(arg);
    }
  }
  return flags;
}

/**
 * Decide how the wizard may behave: "help" | "check" | "interactive" |
 * "defaults". Anything that cannot prompt safely falls back to defaults —
 * that is the `--yes` contract, so CI never blocks on a question.
 */
export function resolveMode({ flags, stdinIsTTY }) {
  if (flags.help) return "help";
  if (flags.check) return "check";
  if (flags.yes || !stdinIsTTY) return "defaults";
  return "interactive";
}

/**
 * Minimal engines-range check: the repo pins a `>=X.Y.Z` floor, so compare
 * the first `>=` triple numerically. Ranges without a `>=` bound do not
 * block — preflight reports, it never guesses.
 */
export function satisfiesNodeRange(version, range) {
  const floor = />=\s*(\d+)\.(\d+)\.(\d+)/.exec(range);
  const current = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!floor || !current) return true;
  for (let i = 1; i <= 3; i++) {
    const delta = Number(current[i]) - Number(floor[i]);
    if (delta !== 0) return delta > 0;
  }
  return true;
}

/**
 * Interactive answer → boolean; empty, non-string, or unrecognised input
 * takes the default. Callers must intercept `null` before this helper —
 * `rl.question` resolves `null` on EOF and that means abort (INPUT_ENDED),
 * not "accept the default".
 */
export function normalizeAnswer(answer, fallback) {
  const normalized = (typeof answer === "string" ? answer : "").trim().toLowerCase();
  if (normalized === "") return fallback;
  if (["y", "yes"].includes(normalized)) return true;
  if (["n", "no"].includes(normalized)) return false;
  return fallback;
}

function readManifest(root) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    return pkg !== null && typeof pkg === "object" && !Array.isArray(pkg) ? pkg : null;
  } catch {
    return null;
  }
}

/**
 * Pick the remediation that matches the kind of env-bootstrap failure.
 * Checkout-layout problems (missing `.env.example`, a non-directory root)
 * mean the wizard ran in the wrong place — "fix the named key" would
 * misdirect. Everything else is a value/key conflict or an unsafe env
 * path, where the preserved-values guidance is the right remedy.
 */
function envSetupRemedy(message) {
  if (/checkout root|\.env\.example/i.test(message)) {
    return "Run the wizard from the repository root — it must see .env.example and the checkout layout.";
  }
  return "Existing values were preserved — fix the named file or key(s) by hand, or remove the file to let the wizard regenerate it.";
}

/**
 * Spawn a fixed-literal repo command. The pinned toolchain goes through
 * `corepack pnpm`, never a bare `pnpm`. On Windows the Corepack shim is a
 * `.cmd` file that CreateProcess cannot exec directly, so the spawn routes
 * through cmd.exe as one joined command string — every argument is a
 * hardcoded literal, so shell quoting is not a concern (and the join keeps
 * Node's DEP0190 args+shell warning silent). `COREPACK_ENABLE_DOWNLOAD_PROMPT`
 * defaults to 0 so a first-run pnpm download cannot block the wizard.
 */
function spawnCommand(argv, { capture = false } = {}) {
  const options = {
    encoding: "utf8",
    env: {
      ...process.env,
      COREPACK_ENABLE_DOWNLOAD_PROMPT: process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT ?? "0",
    },
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  };
  const result =
    process.platform === "win32"
      ? spawnSync(argv.join(" "), { ...options, shell: true })
      : spawnSync(argv[0], argv.slice(1), options);
  return { out: (result.stdout ?? "").trim(), status: result.status ?? 1 };
}

/**
 * The four wizard steps against `root`. `io` carries the side effects so
 * tests can drive the flow without a TTY or real pnpm:
 *   io.print(line)                    — status/progress lines
 *   io.fail(line)                     — failure + remediation lines
 *   io.probe(argv) → { status, out }  — quiet capability probe (capture)
 *   io.run(argv)   → status           — visible child command (inherit)
 *   io.ask(question, fallback)        — interactive only; absent otherwise;
 *                                       returns boolean or INPUT_ENDED
 * Returns the process exit code: 0 ok, 1 on a failed step (with remediation).
 */
export async function runWizard(root, { mode, skipMigrate = false }, io) {
  const check = mode === "check";
  const ask = mode === "interactive" ? io.ask : undefined;
  const pass = (line) => io.print(`PASS: ${line}`);
  const skip = (line) => io.print(`SKIP: ${line}`);
  let failures = 0;
  const fail = (line, hint) => {
    io.fail(`FAIL: ${line}`);
    if (hint) io.fail(`  Remedy: ${hint}`);
    failures += 1;
    return 1;
  };

  // -- Step 1: preflight ----------------------------------------------------
  io.print(check ? "[1/4] Preflight" : "[1/4] Preflight checks");
  const pkg = readManifest(root);
  if (pkg === null) {
    return fail(
      "package.json is missing or unreadable in the current directory.",
      "Run the wizard from the repository root — the folder that holds apps/ and packages/.",
    );
  }
  const engines = pkg.engines?.node;
  if (engines && satisfiesNodeRange(process.version, engines)) {
    pass(`Node.js ${process.version} satisfies engines "${engines}"`);
  } else if (engines) {
    const remedy =
      "Install a supported Node.js LTS release (see README prerequisites), then re-run.";
    const line = `Node.js ${process.version} does not satisfy engines "${engines}".`;
    if (!check) return fail(line, remedy);
    fail(line, remedy);
  } else {
    skip("package.json declares no Node.js engines range — nothing to verify");
  }

  const corepack = io.probe([COREPACK, "--version"]);
  if (corepack.status === 0) {
    pass(`Corepack ${corepack.out || "available"}`);
  } else {
    const line = "corepack is not on PATH — `corepack pnpm` cannot run.";
    const remedy =
      "Install it with `npm install --global corepack` (ships with Node 22); README covers the no-elevation Windows shim.";
    if (!check) return fail(line, remedy);
    fail(line, remedy);
  }
  if (typeof pkg.packageManager === "string" && pkg.packageManager.length > 0) {
    pass(`packageManager "${pkg.packageManager}" — Corepack enforces the pinned toolchain`);
  } else {
    skip("no packageManager field — `corepack pnpm` resolves whatever pnpm is ambient");
  }

  let depsReady = existsSync(path.join(root, "node_modules"));
  if (depsReady) {
    pass("node_modules present — dependencies already installed");
  } else if (check) {
    skip("node_modules missing — run `corepack pnpm install` before the dev server");
  } else if (ask) {
    const install = await ask(
      "Dependencies are not installed yet. Run `corepack pnpm install` now?",
      true,
    );
    if (install === INPUT_ENDED) {
      return fail(
        "input ended mid-prompt — setup aborted.",
        "Re-run `corepack pnpm setup` in an attached terminal, or pass `--yes` / `--check` for a scripted run.",
      );
    }
    if (install) {
      if (io.run(INSTALL_ARGV) === 0) {
        pass("dependencies installed");
        depsReady = true;
      } else {
        return fail(
          "`corepack pnpm install` failed.",
          "Re-run `corepack pnpm install` in a terminal and read the first error — README 'Optional checks' covers the Corepack shim on Windows.",
        );
      }
    } else {
      skip("install declined — run `corepack pnpm install` before starting the dev server");
    }
  } else {
    skip(
      "node_modules missing — non-interactive mode installs nothing; run `corepack pnpm install`",
    );
  }

  // -- Step 2: environment files --------------------------------------------
  io.print("[2/4] Environment files");
  let envProblem = null;
  try {
    setupEnvironment(root, { check: true });
  } catch (err) {
    envProblem = err instanceof Error ? err.message : String(err);
  }
  if (envProblem === null) {
    pass(".env and apps/web/.env.local already hold valid synchronized secrets — nothing to do");
  } else if (check) {
    fail(envProblem);
  } else {
    try {
      const { changedFiles } = setupEnvironment(root);
      pass(
        changedFiles.length > 0
          ? `wrote ${changedFiles.join(", ")} — generated missing secrets, existing values preserved`
          : "env files already valid — nothing written",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(message, envSetupRemedy(message));
    }
  }

  // -- Step 3: database migrations ------------------------------------------
  if (!check) {
    io.print("[3/4] Database migrations");
    const migrateNote = "run `corepack pnpm --filter @supastack/db db:migrate`";
    if (skipMigrate) {
      skip(`--skip-migrate — ${migrateNote} once Postgres is up`);
    } else if (!depsReady) {
      skip(
        `dependencies are not installed — run \`corepack pnpm install\` first, then ${migrateNote}`,
      );
    } else if (!ask) {
      skip(`non-interactive mode runs no migrations — ${migrateNote} once Postgres is up`);
    } else {
      const migrate = await ask(
        "Run database migrations now? Postgres must already be reachable (docker compose up -d postgres).",
        false,
      );
      if (migrate === INPUT_ENDED) {
        return fail(
          "input ended mid-prompt — setup aborted.",
          "Re-run `corepack pnpm setup` in an attached terminal, or pass `--yes` / `--check` for a scripted run.",
        );
      }
      if (migrate) {
        if (io.run(MIGRATE_ARGV) === 0) {
          pass("migrations applied");
        } else {
          return fail(
            "db:migrate failed — usually because Postgres is not reachable yet.",
            MIGRATE_HINT,
          );
        }
      } else {
        skip(`migrations declined — ${migrateNote} once Postgres is up`);
      }
    }
  }

  // -- Step 4: summary -------------------------------------------------------
  if (check) {
    if (failures === 0) {
      io.print("PASS: all checks green — nothing was written");
    } else {
      io.fail(`FAIL: ${failures} check${failures === 1 ? "" : "s"} failed — nothing was written`);
    }
    return failures === 0 ? 0 : 1;
  }
  io.print("[4/4] Setup complete — next steps");
  io.print("  Start the app:    corepack pnpm --filter @supastack/web dev");
  io.print("  Then open:        http://localhost:3000  (in-memory demo — no database needed)");
  io.print("  Real sign-up and saved data need Postgres:");
  io.print("    docker compose up -d postgres");
  io.print("    corepack pnpm --filter @supastack/db db:migrate");
  io.print("  Checklist:        http://localhost:3000/setup (in-app readiness checklist)");
  io.print("  Docs: docs/agent-setup.md (agent runbook) and /docs on the running app");
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help) {
    log(USAGE);
  } else if (flags.unknown.length > 0) {
    error(
      `FAIL: unknown flag${flags.unknown.length === 1 ? "" : "s"}: ${flags.unknown.join(", ")}`,
    );
    error(USAGE);
    process.exitCode = 1;
  } else {
    const stdinIsTTY = Boolean(process.stdin.isTTY);
    const mode = resolveMode({ flags, stdinIsTTY });
    if (mode === "defaults" && !stdinIsTTY) {
      log("Non-interactive stdin detected — running with safe defaults, same as --yes.");
    }
    const io = {
      fail: (line) => error(line),
      print: (line) => log(line),
      probe: (argv) => spawnCommand(argv, { capture: true }),
      run: (argv) => spawnCommand(argv).status,
    };
    let rl;
    if (mode === "interactive") {
      rl = createInterface({ input: process.stdin, output: process.stdout });
      io.ask = async (question, fallback) => {
        // `rl.question` resolves null on EOF (recent Node) but can simply
        // hang on older releases — race it against `close` so Ctrl+D or a
        // truncated pipe always aborts instead of swallowing a default.
        const answer = await Promise.race([
          rl.question(`${question} ${fallback ? "[Y/n]" : "[y/N]"} `),
          once(rl, "close").then(() => null),
        ]);
        return answer === null ? INPUT_ENDED : normalizeAnswer(answer, fallback);
      };
    }
    try {
      process.exitCode = await runWizard(
        process.cwd(),
        { mode, skipMigrate: flags.skipMigrate },
        io,
      );
    } catch (err) {
      error(`FAIL: ${err instanceof Error ? err.message : "setup could not complete"}`);
      process.exitCode = 1;
    } finally {
      rl?.close();
    }
  }
}
