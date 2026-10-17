import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

/**
 * Testable helpers behind `sync-subrepos.mjs` for mirroring the monorepo
 * into the standalone sub-repos (`supastack-web`, `supastack-mobile`,
 * `supastack-desktop`): manifest/render functions are filesystem-in/
 * deterministic, and the generic git plumbing (`runGit`/`git`/`gitOrThrow`/
 * `listGit`, `ignoredPaths`, `captureCheckoutState`/`positionBranch`/
 * `restoreCheckoutState`) takes explicit `cwd`/args so tests can drive real
 * temp repos. The only baked-in process state is `GIT_ENV` — a safety
 * default, not config.
 */

/** Never block on credential prompts (pre-push hook, CI). */
export const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

/** Files generated at the sub-repo root on every sync — never foreign content. */
export const GENERATED = new Set([
  "package.json",
  "README.md",
  "llms.txt",
  ".supastack-sync",
  ".devin/wiki.json",
]);

/**
 * Run `git` in `cwd`, never throwing: `{ok, status, out, err}` with trimmed
 * stdout. `secret` (e.g. a remote URL carrying a token) is scrubbed from
 * captured output before it can reach logs.
 */
export function runGit(cwd, args, secret, input) {
  const scrub = (s) =>
    secret
      ? String(s ?? "")
          .split(secret)
          .join("***")
      : String(s ?? "");
  try {
    const out = execFileSync("git", args, {
      cwd,
      env: GIT_ENV,
      encoding: "utf8",
      input,
      stdio: [input != null ? "pipe" : "ignore", "pipe", "pipe"],
    });
    return { ok: true, status: 0, out: out.trim(), err: "" };
  } catch (e) {
    return {
      ok: false,
      status: e.status,
      out: scrub(e.stdout).trim(),
      err: scrub(e.stderr || e.message),
    };
  }
}

/** git query — trimmed stdout, or null on failure. */
export function git(cwd, args) {
  const res = runGit(cwd, args);
  return res.ok ? res.out : null;
}

/** git command — prints sanitized stderr and throws on failure. */
export function gitOrThrow(cwd, args, secret) {
  const res = runGit(cwd, args, secret);
  if (!res.ok) {
    if (res.err) process.stderr.write(`${res.err}\n`);
    throw new Error(`git ${args[0]} failed`);
  }
  return res.out;
}

/** git query — stdout split into non-empty lines, [] on failure. */
export function listGit(cwd, args) {
  const res = runGit(cwd, args);
  return res.ok ? res.out.split("\n").filter(Boolean) : [];
}

/**
 * Paths among `files` that git would ignore in `cwd` — evaluated against that
 * repo's own index/gitignore, so a path tracked in the monorepo but ignored
 * downstream (e.g. a `.impeccable` state file committed by accident) is still
 * dropped before it can break `git add` in the target checkout.
 */
export function ignoredPaths(cwd, files, { warn } = {}) {
  const res = runGit(cwd, ["check-ignore", "--stdin"], null, [...files].join("\n"));
  if (!res.ok) {
    // exit 1 = none of the paths are ignored; anything else is a real failure
    if (res.status !== 1) warn?.(`[subrepos] warning: git check-ignore failed — ${res.err}`);
    return new Set();
  }
  return new Set(res.out.split("\n").filter(Boolean));
}

/**
 * Where the checkout sits before the sync moves it, for later restore:
 * `headSha` — resolved HEAD (null when unborn, e.g. a fresh `git init`),
 * `headBranch` — short symbolic-ref of HEAD (null when detached; readable
 * even when unborn), `branchSha` — current `refs/heads/<branch>` tip or
 * null when the branch does not exist yet.
 */
export function captureCheckoutState(work, branch) {
  return {
    headSha: git(work, ["rev-parse", "--quiet", "--verify", "HEAD"]),
    headBranch: git(work, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
    branchSha: git(work, ["rev-parse", "--quiet", "--verify", `refs/heads/${branch}`]),
  };
}

/**
 * Put `work` on `branch`, preserving local commits. With a fetched
 * `origin/<branch>` tip and a born HEAD, `<branch>` is reset to HEAD and the
 * local commits are replayed onto the remote tip — an unpushed
 * `chore: sync …` commit (or `--force`-sibling foreign commits) survives
 * instead of being silently orphaned by `checkout -B <branch>
 * origin/<branch>`; a HEAD already behind the remote tip simply
 * fast-forwards. On rebase failure the rebase is aborted, the pre-call
 * checkout state is restored, the rebase stderr is warned, and false is
 * returned so the caller skips the repo — the checkout is never left
 * wedged mid-rebase or with moved refs. Without a remote tip or a born
 * HEAD the previous positioning paths apply unchanged.
 */
export function positionBranch(work, branch, { remote, warn } = {}) {
  const state = captureCheckoutState(work, branch);
  const remoteTip = git(work, ["rev-parse", "--verify", `origin/${branch}`]);
  if (remoteTip !== null && state.headSha !== null) {
    gitOrThrow(work, ["checkout", "-f", "-B", branch, "HEAD"], remote);
    const rebase = runGit(work, ["rebase", `origin/${branch}`], remote);
    if (!rebase.ok) {
      // --abort restores ORIG_HEAD; --quit sweeps leftover rebase-merge
      // state when abort itself could not run. Both are best-effort.
      if (!runGit(work, ["rebase", "--abort"], remote).ok) {
        runGit(work, ["rebase", "--quit"], remote);
      }
      restoreCheckoutState(work, branch, state, { remote, warn });
      warn?.(`[subrepos] rebase onto origin/${branch} failed — ${rebase.err || rebase.out}`);
      return false;
    }
  } else if (remoteTip !== null) {
    gitOrThrow(work, ["checkout", "-f", "-B", branch, `origin/${branch}`], remote);
  } else if (state.headSha !== null) {
    gitOrThrow(work, ["checkout", "-f", "-B", branch, "HEAD"], remote);
  } else {
    gitOrThrow(work, ["checkout", "-f", "-B", branch], remote);
  }
  return true;
}

/**
 * Best-effort undo of what positioning did to refs and the checkout
 * position, from a captureCheckoutState() snapshot — used on rebase
 * failure and for the `--dry-run` sibling restore. `refs/heads/<branch>`
 * goes back to its captured tip (or is deleted when it did not exist and
 * positioning created it), HEAD returns to `headBranch` (symbolic-ref
 * fallback for an unborn target) or detached `headSha`, then
 * `reset --hard` realigns tracked files and the index. Ordered so it also
 * works when the original HEAD was unborn — note an unborn restore leaves
 * `.git/index` populated (`reset` has no HEAD to target), so callers drop
 * the index themselves as the CLI's dry-run does. Never throws; failures
 * are reported through `warn`.
 */
export function restoreCheckoutState(work, branch, state, { remote, warn } = {}) {
  const say = typeof warn === "function" ? warn : () => {};
  const attempt = (args) => {
    const res = runGit(work, args, remote);
    if (!res.ok) {
      say(`[subrepos] warning: restore 'git ${args.join(" ")}' failed — ${res.err}`);
    }
    return res.ok;
  };

  const ref = `refs/heads/${branch}`;
  const current = git(work, ["rev-parse", "--quiet", "--verify", ref]);
  if (current !== state.branchSha) {
    if (state.branchSha === null) {
      // Positioning created the ref — delete it so the branch returns to
      // not existing (HEAD may be left unborn, as before).
      attempt(["update-ref", "-d", ref]);
    } else {
      attempt(["update-ref", ref, state.branchSha]);
    }
  }

  if (state.headBranch !== null) {
    const headRef = `refs/heads/${state.headBranch}`;
    if (git(work, ["rev-parse", "--quiet", "--verify", headRef]) !== null) {
      attempt(["checkout", "--force", state.headBranch]);
    } else {
      // The original branch ref did not exist — checkout cannot select it,
      // so point HEAD at the (unborn) branch symbolically.
      attempt(["symbolic-ref", "HEAD", headRef]);
    }
  } else if (state.headSha !== null) {
    attempt(["checkout", "--force", state.headSha]);
  }
  if (git(work, ["rev-parse", "--quiet", "--verify", "HEAD"]) !== null) {
    attempt(["reset", "--hard", "HEAD"]);
  }
}

/** Remove `rel`'s now-empty parent dirs inside `work`, bottom-up. */
export async function pruneEmptyDirs(work, rel) {
  let dir = path.dirname(path.resolve(work, rel));
  while (dir.startsWith(work) && dir !== work) {
    try {
      await fs.rmdir(dir);
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

/**
 * Full `--dry-run` unwind for a sibling checkout after mirror+stage —
 * invoked on EVERY dry-run sibling exit (the "up to date" early return
 * included: positioning has already moved refs even when the staged diff
 * is empty). Refs/HEAD go back via restoreCheckoutState, tracked files +
 * index realign to the restored HEAD (`reset --hard`; an unborn restore
 * drops `.git/index` instead), then synced/generated files the repo did
 * not already track are deleted along with their emptied parent dirs.
 * Foreign untracked files are never in `files`/`GENERATED`, so they
 * survive. Managed clones are disposable and skip this entirely.
 */
export async function restoreDryRunSibling(
  work,
  branch,
  state,
  { files, prevTracked = new Set(), remote, warn } = {},
) {
  restoreCheckoutState(work, branch, state, { remote, warn });
  if (git(work, ["rev-parse", "--quiet", "--verify", "HEAD"]) !== null) {
    gitOrThrow(work, ["reset", "--hard", "HEAD"], remote);
  } else {
    await fs.rm(path.join(work, ".git", "index"), { force: true });
  }
  for (const rel of [...(files ?? []), ...GENERATED]) {
    if (!prevTracked.has(rel)) {
      await fs.rm(path.join(work, rel), { force: true });
      await pruneEmptyDirs(work, rel);
    }
  }
}

/**
 * Second ignore pass for `syncRepo`: `check-ignore` reads the checkout's
 * CURRENT worktree .gitignore files, which on a pre-existing checkout are
 * still the previous sync's revisions — a stale `.ai/` rule there dropped
 * every mirror doc from `files` before `mirror()` could write the new
 * rules. The pass must evaluate what the sync is ABOUT to commit, so
 * every `.gitignore` in `files` (root + nested, e.g.
 * `apps/desktop/src-tauri/.gitignore`) is written into `work` first —
 * verbatim from `root`, `ROOT_FILE_RENDERERS` applied defensively like
 * `mirror()` does; `mirror()` rewrites them idempotently moments later.
 * Removes each still-ignored path from `files` and returns the dropped
 * set — so paths the old rules ignored but the new ones allow now ship,
 * and newly ignored paths are still dropped.
 */
export async function applyShippedIgnoreRules(work, files, { root, warn } = {}) {
  for (const rel of files) {
    if (path.posix.basename(rel) !== ".gitignore") continue;
    const render = ROOT_FILE_RENDERERS[rel];
    const source = await fs.readFile(path.join(root, rel), "utf8");
    const dest = path.join(work, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, render ? render(source) : source);
  }
  const ignored = ignoredPaths(work, files, { warn });
  for (const f of ignored) files.delete(f);
  return ignored;
}

/** Directory names never copied into a sub-repo. */
const EXCLUDED_DIR_NAMES = new Set([
  ".expo",
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "gen",
  "node_modules",
  "out",
  "target",
]);

/** Root files copied verbatim into every sub-repo. package.json and README.md
 * are generated instead (renderRootPackageJson / renderReadme). */
const ROOT_FILES = [
  ".env.example",
  ".gitattributes",
  ".gitignore",
  ".prettierignore",
  "AGENTS.md",
  "LICENSE.md",
  "docs/aws-ses.md",
  "eslint.config.mjs",
  "pnpm-workspace.yaml",
  "prettier.config.mjs",
  "tsconfig.base.json",
  "turbo.json",
  "vitest.config.ts",
];

const KEEP_SCRIPTS = [
  "build",
  "check",
  // Rendered AGENTS.md + shipped prompts tell buyers to run `check:local`;
  // both work verbatim downstream — `typecheck:local`'s
  // `--filter=!@supastack/desktop` simply matches everything where the
  // desktop app is absent. `verify:*`/`typecheck:desktop`/`test:e2e*` stay
  // out: they need Playwright or the Rust toolchain, which never ships.
  "check:local",
  "dev",
  "format",
  "format:check",
  // Documented in the shipped .env.example/AGENTS.md — the script it runs
  // (scripts/scheduler-tick.mjs) must reach the manifest via extraPaths.
  "jobs:tick",
  "lint",
  "test",
  "test:watch",
  "typecheck",
  "typecheck:local",
];

const KEEP_DEV_DEPS = [
  "@eslint/js",
  "@types/node",
  "eslint",
  "prettier",
  "turbo",
  "typescript",
  "typescript-eslint",
  "vitest",
];

function withoutTestScriptCommands(command) {
  return command
    .split(/\s*&&\s*/)
    .map((step) => step.trim())
    .filter((step) => !/^(?:corepack\s+)?pnpm\s+(?:run\s+)?test(?::watch)?$/.test(step))
    .join(" && ");
}

/** Map every workspace package name to its repo-relative dir. */
export async function workspacePackageMap(root) {
  const map = new Map();
  for (const scope of ["apps", "packages"]) {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, scope), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = `${scope}/${entry.name}`;
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(root, dir, "package.json"), "utf8"));
        if (typeof pkg.name === "string") map.set(pkg.name, dir);
      } catch {
        // Directory without a readable package.json is not a workspace member.
      }
    }
  }
  return map;
}

/** Sorted repo-relative dirs reachable from appDir through workspace:* deps. */
export async function packageClosure(root, appDir) {
  const map = await workspacePackageMap(root);
  const result = new Set();
  const queue = [appDir];
  while (queue.length > 0) {
    const dir = queue.shift();
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(path.join(root, dir, "package.json"), "utf8"));
    } catch {
      continue;
    }
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (typeof range !== "string" || !range.startsWith("workspace:")) continue;
        const depDir = map.get(name);
        if (depDir && depDir !== appDir && !result.has(depDir)) {
          result.add(depDir);
          queue.push(depDir);
        }
      }
    }
  }
  return [...result].sort();
}

/**
 * Derive `<org>/<name>.git` from the monorepo origin URL, preserving the
 * protocol and host. Returns null when the origin cannot be parsed.
 */
export function deriveRemote(originUrl, name) {
  if (typeof originUrl !== "string" || originUrl.length === 0) return null;

  const ssh = originUrl.match(/^([^@\s]+@[^:\s]+):(.+)$/);
  if (ssh) {
    const org = ssh[2]
      .replace(/\.git$/, "")
      .split("/")
      .slice(0, -1)
      .join("/");
    return org ? `${ssh[1]}:${org}/${name}.git` : null;
  }

  let url;
  try {
    url = new URL(originUrl);
  } catch {
    return null;
  }
  const parts = url.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 2) return null;
  const org = parts.slice(0, -1).join("/");
  return `${url.protocol}//${url.host}/${org}/${name}.git`;
}

/** Sorted repo-relative file list to mirror into the sub-repo. Every shipped
 * file also pulls in its `.ai` mirror doc when one exists (agent-memory
 * convention), so buyer checkouts keep the per-file docs. */
export async function buildFileManifest(root, spec) {
  const files = new Set();
  const patches = await fs.stat(path.join(root, "patches")).catch(() => null);
  if (patches?.isDirectory()) await walk(root, "patches", files);
  const dirs = [spec.app, ...(await packageClosure(root, spec.app))];
  for (const dir of dirs) {
    await walk(root, dir, files);
  }
  for (const file of ROOT_FILES) {
    try {
      const stat = await fs.stat(path.join(root, file));
      if (stat.isFile()) files.add(file);
    } catch {
      // Optional root file missing — skip.
    }
  }
  for (const extra of spec.extraPaths ?? []) {
    const stat = await fs.stat(path.join(root, extra)).catch(() => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      await walk(root, extra, files);
    } else if (stat.isFile()) {
      files.add(extra);
    }
  }
  // `.ai/` mirrors ride along for shipped files only — a mirror of an
  // unshipped file (e.g. `.ai/scripts/subrepos.mjs.md`, `.ai/tests/**`)
  // never enters the set, so the tree stays self-consistent downstream.
  const mirrors = await Promise.all([...files].map((file) => aiMirrorPath(root, file)));
  for (const mirror of mirrors) {
    if (mirror) files.add(mirror);
  }
  // The `.ai` system's entry doc mirrors no file — include it explicitly.
  try {
    const stat = await fs.stat(path.join(root, ".ai/PROJECT_CONTEXT.md"));
    if (stat.isFile()) files.add(".ai/PROJECT_CONTEXT.md");
  } catch {
    // Optional — skip when the .ai tree is absent.
  }
  // The monorepo README is replaced by a generated buyer README downstream,
  // so its mirror would document a file that does not exist there.
  files.delete(".ai/README.md");
  return [...files].sort();
}

/**
 * `.ai/<…>.md` mirror path for a shipped repo-relative file, or null when
 * none exists. Conventions tried in order (first hit wins — most files have
 * no mirror at all):
 *   a. strip last ext: `apps/web/src/x.ts` → `.ai/apps/web/src/x.md`,
 *      `package.json` → `.ai/package.md`
 *   b. append:         `.env.example`      → `.ai/.env.example.md`
 *   c. dotfile strip:  `.gitattributes`    → `.ai/gitattributes.md`
 */
async function aiMirrorPath(root, rel) {
  const dir = path.posix.dirname(rel);
  const base = path.posix.basename(rel);
  const prefix = dir === "." ? ".ai" : `.ai/${dir}`;
  const ext = path.posix.extname(base);
  const candidates = [`${prefix}/${ext ? base.slice(0, -ext.length) : base}.md`, `.ai/${rel}.md`];
  if (base.startsWith(".")) {
    candidates.push(`${prefix}/${base.slice(1)}.md`);
  }
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(path.join(root, candidate));
      if (stat.isFile()) return candidate;
    } catch {
      // Candidate not present — try the next convention.
    }
  }
  return null;
}

async function walk(root, relDir, out) {
  const entries = await fs.readdir(path.join(root, relDir), { withFileTypes: true });
  for (const entry of entries) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry.name)) {
        await walk(root, rel, out);
      }
    } else if (entry.isFile() && !entry.name.endsWith(".tsbuildinfo")) {
      out.add(rel);
    }
  }
}

/** Standalone root package.json for a sub-repo. When `files` is given, the
 * test scripts are dropped for repos that ship no tests (vitest is configured
 * with passWithNoTests: false upstream). */
export function renderRootPackageJson(rootPkg, spec, files) {
  const hasTests = files == null || files.some((f) => /\.test\.[jt]sx?$/.test(f));
  const scripts = {};
  for (const key of KEEP_SCRIPTS) {
    if (!hasTests && key.startsWith("test")) continue;
    if (typeof rootPkg.scripts?.[key] === "string") {
      scripts[key] = hasTests
        ? rootPkg.scripts[key]
        : withoutTestScriptCommands(rootPkg.scripts[key]);
    }
  }
  for (const [key, value] of Object.entries(spec.scripts ?? {})) {
    scripts[key] = value;
  }

  const devDependencies = {};
  for (const key of KEEP_DEV_DEPS) {
    if (typeof rootPkg.devDependencies?.[key] === "string") {
      devDependencies[key] = rootPkg.devDependencies[key];
    }
  }

  return {
    name: spec.name,
    version: rootPkg.version ?? "0.1.0",
    license: "SEE LICENSE IN LICENSE.md",
    private: true,
    type: "module",
    ...(rootPkg.packageManager ? { packageManager: rootPkg.packageManager } : {}),
    ...(rootPkg.engines ? { engines: rootPkg.engines } : {}),
    scripts,
    devDependencies,
  };
}

/**
 * Where the mirror is materialized. Sibling mode (a real checkout the user can
 * run from) applies when the spec declares `checkout` or `SUBREPO_HOME` points
 * at a parent dir; otherwise the managed staging clone under `.subrepos/`.
 * `spec.checkout` wins over `SUBREPO_HOME`.
 */
export function resolveWorkDir(root, spec, { env = {} } = {}) {
  const sibling = spec.checkout
    ? spec.checkout
    : env.SUBREPO_HOME
      ? path.join(env.SUBREPO_HOME, spec.name)
      : null;
  if (!sibling) {
    return { dir: path.join(root, ".subrepos", spec.name), mode: "managed" };
  }
  return { dir: path.resolve(root, sibling), mode: "sibling" };
}

/** Remote precedence: env override → the sibling checkout's own origin →
 * same-org URL derived from the monorepo origin. */
export function resolveRemote(spec, { env = {}, originUrl, siblingOrigin } = {}) {
  return env[spec.remoteEnv] || siblingOrigin || deriveRemote(originUrl, spec.name) || null;
}

/** Standalone README stamped into every sub-repo root — buyer-facing: these
 * repos are forked and built on, so explain the layout and update flow instead
 * of warning people off editing. */
export function renderReadme(spec) {
  const dir = spec.app.replace(/^apps\//, "");
  return `# ${spec.name}

The **supastack** ${dir} starter — a standalone
pnpm workspace you can fork and build your product on.

## Quickstart

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Agents: read \`llms.txt\` first, then \`AGENTS.md\`.

## What's inside

- \`${spec.app}/\` — the application
- \`packages/*\` — the shared workspace packages it depends on (selected by
  dependency graph, so unrelated apps/packages are not included)
- \`scripts/\` — root helper scripts invoked by package.json scripts
  (e.g. \`pnpm jobs:tick\` fires one scheduler tick against a running app)
- Workspace tooling: \`turbo.json\`, \`pnpm-workspace.yaml\`,
  \`vitest.config.ts\`, \`eslint.config.mjs\`, \`prettier.config.mjs\`,
  \`tsconfig.base.json\`
- \`AGENTS.md\` — conventions for coding agents working in this repo
- \`llms.txt\` — agent entry map (llmstxt.org format): docs index, prompts,
  security protocols
- \`.ai/\` — per-file agent memory docs, mirrored for the files that ship here

## Where do updates come from?

This repo is published from the upstream supastack monorepo. Upstream changes
arrive as \`chore: sync from supastack@<sha>\` commits; \`.supastack-sync\`
records the exact source revision and can be ignored.

Your fork is yours — edit freely. If you pull upstream syncs later, resolve
conflicts by preferring synced content for files you have not customized.

## License

Use of this codebase is governed by \`LICENSE.md\` at the repo root. In short:
your license lets you build, ship, and sell unlimited end products — the
codebase itself can't be redistributed or published in a public repository.
Each developer with codebase access needs their own seat.
`;
}

/**
 * `llms.txt` (llmstxt.org) generated into every sub-repo root — the entry map
 * agents read first. Every link is gated on `files` (the shipped manifest,
 * array or Set), so the file never points at content the checkout does not
 * carry; GENERATED paths count as shipped because `mirror()` writes them
 * unconditionally — except `.devin/wiki.json`, the conditional GENERATED
 * member that is written only when the monorepo has a source wiki, so its
 * link follows literal `files` membership (callers add it to `files` iff the
 * wiki will be written). Pure — no fs reads — so package rows link by
 * directory name instead of summarizing package.json descriptions.
 */
export function renderLlmsTxt(spec, files) {
  const have = new Set(files);
  const ships = (rel) => have.has(rel) || GENERATED.has(rel);
  const dir = (spec.app ?? "").replace(/^apps\//, "") || "product";
  const flavor =
    {
      "apps/web": "the full Next.js product app plus the marketing/docs surface",
      "apps/mobile": "the Expo mobile app, which talks to a running web backend",
      "apps/desktop": "the Tauri desktop shell over the web app",
    }[spec.app] ?? `the ${dir} app`;

  /** `docs/agent-setup.md` → "Agent Setup" link label (known marks fixed up). */
  const label = (rel) => {
    const marks = {
      ai: "AI",
      api: "API",
      github: "GitHub",
      mcp: "MCP",
      oauth: "OAuth",
      ui: "UI",
      vps: "VPS",
    };
    return path.posix
      .basename(rel, path.posix.extname(rel))
      .split(/[-_]+/)
      .filter(Boolean)
      .map((word) => marks[word.toLowerCase()] ?? word[0].toUpperCase() + word.slice(1))
      .join(" ");
  };

  const lines = [
    `# ${spec.name}`,
    "",
    `> The supastack ${dir} starter — ${flavor}.`,
    "> Shipped as a standalone pnpm workspace to fork and build a product on.",
  ];
  const section = (heading, entries) => {
    if (entries.length > 0) lines.push("", `## ${heading}`, "", ...entries);
  };

  const start = [];
  if (ships("AGENTS.md"))
    start.push(
      "- [AGENTS.md](AGENTS.md): conventions and non-negotiable boundaries for coding agents",
    );
  if (ships("README.md"))
    start.push(
      "- [README.md](README.md): repo overview, quickstart, and how upstream updates arrive",
    );
  if (ships(".env.example"))
    start.push(
      spec.app === "apps/web"
        ? "- [.env.example](.env.example): full environment inventory — copy to .env and apps/web/.env.local"
        : "- [.env.example](.env.example): full environment inventory — copy to .env",
    );
  section("Start here", start);

  // Deploy/ops links — docs claimed here are not repeated under Guides.
  const deploy = [
    [
      "docs/agent-setup.md",
      "Agent setup",
      "Docker/Podman local setup plus Coolify or plain-VPS Docker deploy runbook",
    ],
    [
      "scripts/setup-env.mjs",
      "Environment setup helper",
      "safely creates local env files from the shipped example without replacing existing values",
    ],
    [
      "scripts/setup.mjs",
      "Guided setup wizard",
      "interactive `pnpm setup` — preflight checks, env bootstrap, optional dependency install and database migrations (`--check`/`--yes` keep it script-safe)",
    ],
    ["docs/deployment.md", "Deployment", "production topology, env wiring, go-live checks"],
    ["docs/vps-coolify.md", "Docker on a VPS (Coolify)", "containerized deploy on your own VPS"],
    ["Dockerfile", "Dockerfile", "production container build"],
    ["docker-compose.yml", "docker-compose.yml", "production container orchestration"],
    ["docker-compose.dev.yml", "docker-compose.dev.yml", "containerized dev environment"],
  ];
  const claimed = new Set([...deploy.map(([rel]) => rel), "docs/agent-security.md"]);
  const deployEntries = deploy
    .filter(([rel]) => ships(rel))
    .map(([rel, name, note]) => `- [${name}](${rel}): ${note}`);
  if (!ships("docs/agent-setup.md"))
    deployEntries.push(
      "Backend Docker/Podman local setup, Coolify/plain-VPS Docker deployment, and the pasteable setup prompt live in the supastack-web checkout.",
    );
  section(
    ships("docs/agent-setup.md") ? "Agent setup & deploy" : "Deploy the backend",
    deployEntries,
  );

  const guideNotes = {
    "docs/adopt-patterns.md": "adopting the kit's patterns in your own product",
    "docs/aws-ses.md": "sending transactional email through AWS SES",
    "docs/custom-billing-adapter.md": "adding a billing provider adapter",
    "docs/desktop-updates.md": "signing desktop updates and injecting updater config at build time",
    "docs/github-auth-setup.md": "configuring GitHub OAuth sign-in",
    "docs/mobile-store-submission.md": "submitting the mobile app to the app stores",
    "docs/production-ai-runtime.md": "running real AI providers in production",
    "docs/real-provider-smoke.md": "smoke-testing real provider credentials",
    "docs/upgrading.md": "pulling upstream changes into a fork",
  };
  section(
    "Guides",
    [...have]
      .filter((f) => /^docs\/[^/]+\.md$/.test(f) && !claimed.has(f))
      .sort()
      .map((f) => `- [${label(f)}](${f})${guideNotes[f] ? `: ${guideNotes[f]}` : ""}`),
  );

  const promptNotes = {
    "prompts/agent-setup.md": "pasteable prompt: stand the kit up and deploy it",
    "prompts/new-app-screen.md": "scaffold a screen inside the workspace app shell",
    "prompts/new-landing-page.md": "scaffold a marketing/landing page from kit blocks",
    "prompts/pick-a-style.md": "apply a design style across the whole product",
    "prompts/restyle-product.md": "re-theme an existing page onto kit tokens",
    "prompts/ui-audit.md": "run the visual/accessibility audit on a route",
  };
  // prompts/README.md (ASCII sorts first) introduces the rest of the shelf.
  section(
    "Agent prompts",
    [...have]
      .filter((f) => /^prompts\/[^/]+\.md$/.test(f))
      .sort()
      .map((f) =>
        f === "prompts/README.md"
          ? "- [Prompt library](prompts/README.md): index of the shipped agent prompts"
          : `- [${label(f)}](${f})${promptNotes[f] ? `: ${promptNotes[f]}` : ""}`,
      ),
  );

  // Invariants that apply to every repo flavor — always emitted; the file
  // anchors are still gated on what ships.
  const security = [];
  if (ships("docs/agent-security.md"))
    security.push(
      "- [Agent security](docs/agent-security.md): session and workspace checks, PostgREST exposure and RLS/grant checks, redacted diagnostics, and deployment acceptance evidence",
    );
  if (ships("AGENTS.md"))
    security.push(
      "- [AGENTS.md](AGENTS.md): the full boundary list — `workspaceId` scoping, server-only secrets, neutral demo content",
    );
  if (ships(".env.example"))
    security.push(
      "- [.env.example](.env.example): only explicitly client-safe values use `NEXT_PUBLIC_`/`EXPO_PUBLIC_`; provider credentials, database URLs, and auth/session keys stay server-side",
    );
  if (ships("packages/auth/src/index.ts"))
    security.push(
      "- [Auth adapter](packages/auth/src/index.ts): Better Auth is the default engine and Auth.js is selectable; the web BFF verifies sessions or scoped keys and enforces workspace authorization.",
    );
  if (ships("packages/db/src/schema.ts"))
    security.push(
      "- [Database schema](packages/db/src/schema.ts): user-owned records carry `workspaceId`; derive it from the authorized caller and scope every query.",
    );
  if (ships("packages/observability/src/index.ts"))
    security.push(
      "- [Observability logger](packages/observability/src/index.ts): use static messages and structured context; sensitive context keys are redacted, while arbitrary message text is not scrubbed.",
    );
  security.push(
    "- Scope every user-owned record by `workspaceId` — callers and tools inject it; the model never picks a workspace.",
    "- Authenticate application requests with Better Auth by default (Auth.js is selectable); server-side BFF handlers enforce session or scoped API-key access and workspace authorization.",
    "- Keep provider/webhook secrets server-only; generate new secrets with `openssl rand`; use static log messages and redacted structured context, preserve safe workspace/correlation IDs, and never log raw request payloads, env files, or connection strings.",
    "- Keep rate limiting on public/API endpoints; set `TRUSTED_PROXY_COUNT` so limits key on real client IPs.",
    "- Write audit-log rows for privileged and billing-affecting actions.",
    // The doctor script ships only where `scripts/supabase-doctor.mjs` is in
    // the manifest (the web repo) — other flavors get the outcome, not a
    // command that does not exist there.
    ships("scripts/supabase-doctor.mjs")
      ? "- [Supabase doctor](scripts/supabase-doctor.mjs): `pnpm supabase:doctor --fix-rls` audits and repairs RLS/grants for PostgREST-exposed tables; inspect the SQL, then rerun the clean audit. BFF session/workspace checks remain required."
      : "- On Supabase, check the PostgREST exposure surface and verify RLS policies/grants for its tables; this database boundary is separate from BFF session/workspace authorization.",
    "- Never disable a security feature (RLS, rate limits, CORS) to silence an error — fix the cause.",
  );
  section("Security protocols", security);

  section(
    "Packages",
    [...have]
      .filter((f) => /^packages\/[^/]+\/package\.json$/.test(f))
      .sort()
      .map((f) => `- [${f.replace(/\/package\.json$/, "")}](${f}): shared workspace package`),
  );

  const optional = [];
  if (ships("LICENSE.md"))
    optional.push("- [License](LICENSE.md): terms for building on this codebase");
  if (have.has(".ai/PROJECT_CONTEXT.md"))
    optional.push(
      "- [.ai/](.ai/PROJECT_CONTEXT.md): per-file agent memory docs mirrored for shipped files",
    );
  // `.devin/wiki.json` sits in GENERATED, but `mirror()` writes it only when
  // the monorepo has a source `.devin/wiki.json` — so GENERATED membership is
  // not evidence it will exist. The link follows literal `files` membership;
  // callers pass it inside `files` only when the wiki will be written.
  if (have.has(".devin/wiki.json"))
    optional.push(
      "- [.devin/wiki.json](.devin/wiki.json): generated DeepWiki steering scoped to this repo's shipped code",
    );
  section("Optional", optional);

  return `${lines.join("\n")}\n`;
}

/**
 * Lines a buyer fork must never see, wherever they appear: monorepo-internal
 * machinery (the maintainer's other repos/products, storefront/fulfillment
 * prose) and the sub-repo sync pipeline itself (scripts, env plumbing,
 * provenance marker, sibling checkouts). Shared by renderAgentsMd and
 * renderAiMirror so both filters stay in lockstep.
 */
const INTERNAL_ONLY_LINE =
  /starterkit|supastack-site|vorlee|fklearn|seller|storefront|sub-?repos?\b|subrepos\.|sync:subrepos|sync-subrepos|SUBREPO_|supastack-sync|supastack-kit|supastarter|\.\.\/supastack-(web|mobile|desktop)/i;

/**
 * Stricter second pass applied ONLY inside `renderAiMirror`: seller/repo
 * provenance that INTERNAL_ONLY_LINE deliberately does not cover. Catches —
 *   - org/product names (`Supastack-dev`, `Learnmore`, `kit-upstream`,
 *     `outreach-product`) and agent provenance (`Devin`, `Codex`, `devin/`/
 *     `codex/`/`feat/`/`archive/` internal branches and tags; the lookbehind
 *     keeps the shipped `.devin/wiki.json` mentionable);
 *   - internal git state (uncommitted/unpushed/not-pushed, merge commits,
 *     ahead-behind remotes, `origin/main`, `refs/heads`, SHAs, `chore: sync`
 *     commits, history rewrites, sibling-checkout plumbing);
 *   - sync-pipeline internals (the module's own function/const names, mirror
 *     bookkeeping, `SUBREPO_*`, `sync:subrepos`, `.subrepos`, `extraPaths`,
 *     `.agents/` skills, `.github/` CI, `.githooks`, `tests/` paths,
 *     `docs/superpowers`, `.impeccable`);
 *   - commands buyers cannot run (`verify:*`, `test:e2e*`, `*:desktop`,
 *     `smoke:providers`, `supabase:provision`, `pnpm verify`/`pnpm smoke`).
 * Descriptive vocabulary is intentionally left alone: bare `upstream`,
 * `monorepo`, `tests`, `checkout`, `dry run`-less prose, `e2e`, `playwright`,
 * `rebase`, `sibling` (DOM), `local-only`, `feat` inside words, `archive/`
 * prose, `all 4 locales`/`all three` non-repo phrases all survive — the pass
 * targets provenance tokens, not words.
 */
const INTERNAL_PROVENANCE_LINE =
  /Supastack-dev|supastack-dev|Learnmore|kit-upstream|outreach-product|(?<![\w.])[Dd]evin\b|\b[Cc]odex\b|\bfeat\b|prod-ready-kit|archive\/(?:feat|main)-|archive\/[\w-]*-\d{4}-\d{2}-\d{2}|origin\/(?:devin|codex|feat|archive)\b|origin\/main\b|`[0-9a-f]{7,40}`|refs\/(?:heads|HEAD)|<branch>|remote tip|diff --cached|reset --hard|reflog|SHA leases?|history rewrit|local refs|pull-request refs|PR merges?|ahead \d+ \/ behind \d+|[Ii]ssue #\d+|uncommitted|unpushed|[Nn]ot (?:yet )?pushed|[Nn]othing pushed|[Nn]o push|[Ll]ocal commit|stays? (?:local|unmerged|uncommitted|unpushed)|[Ll]ocal only|this work is local|push failed|sync\/push|placeholder-ized|[Rr]emote (?:state|refs)|merged the|merged with the code|topic branches|already-merged|tip is tagged|pre-consolidation|branch consolidation|checkout now tracks|primary checkout|checkouts?[^.\n]*dirty|stale-checkout|checkout's own|siblings?\s+(?:checkouts?|sync|refs?|guards?|dry[- ]run|clones?|repos?|on the)|(?:dry[- ]run|sync)\s+siblings?|[Dd]ry[- ]run|deriveRemote|repository_owner|check-ignore|pathspec|sync machinery|sync manifest|monorepo-internal|monorepo-local|sync branch|sync commits?|sync e2e|bare repos?|real-git|fixture repos?|useConfigOnly|committer|force-include|extraPaths|managed clones?|foreign[- ]commits?|chore: sync|supastack@|audit swarm|buyer-clean|buyer-safe phrasing|buyer audience|seat rule|one-time-purchase|buildFileManifest|aiMirrorPath|packageClosure|workspacePackageMap|renderRootPackageJson|renderReadme|renderLlmsTxt|renderAgentsMd|renderAiMirror|renderEnvExample|renderWikiJson|ROOT_FILE_RENDERERS|ROOT_FILES|KEEP_SCRIPTS|KEEP_DEV_DEPS|EXCLUDED_DIR_NAMES|WIKI_PAGE_SHIP|withoutTestScriptCommands|resolveWorkDir|resolveRemote|runGit|gitOrThrow|listGit|GIT_ENV|ignoredPaths|applyShippedIgnoreRules|captureCheckoutState|positionBranch|restoreCheckoutState|restoreDryRunSibling|pruneEmptyDirs|siblingGuard|syncRepo|GENERATED|mirror\(\)|husk|strip-ext|dotfile-strip|INTERNAL_ONLY_LINE|INTERNAL_PROVENANCE_LINE|KNOWN_UNSHIPPED_COMMANDS|KNOWN_HAN_MIRRORS|sync:subrepos|SUBREPO_|\.subrepos|\.agents\/|writing-changelogs|\.impeccable|\.githooks|\.github\/|docs\/superpowers|tests\/[\w`/-]|survives downstream|generated downstream|\.ai\/README|`\.ai\/?` mirrors|[Aa]ll (?:4|four) repos|[Aa]ll three (?:repos|remotes|platform targets|GitHub)|pnpm (?:run )?(?:verify|smoke|test:e2e[\w:-]*|dev:desktop|build:desktop|typecheck:desktop)[\w:-]*|\bverify:[\w*:-]+|typecheck:desktop|dev:desktop|build:desktop|test:e2e[\w:*-]*|smoke:providers|supabase:provision|[Vv]itest workers?|\d[\d,]*\/\d[\d,]*\s+green/;

/**
 * AGENTS.md variant for sub-repos: drop the monorepo-internal instructions
 * that reference machinery which does not exist here (the sync script itself,
 * sibling checkouts). `.ai/` mirror docs legitimately ship downstream, so
 * the agent-memory instruction survives — only lines matching
 * INTERNAL_ONLY_LINE are removed.
 */
export function renderAgentsMd(text) {
  const lines = text.split(/\r?\n/).filter((line) => {
    const t = line.trimStart();
    return !(t.startsWith("- Sub-repos (") || INTERNAL_ONLY_LINE.test(line));
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * `.ai` mirror docs ship to sub-repos, but only after dropping the
 * internal-only lines (INTERNAL_ONLY_LINE) plus the stricter seller/repo
 * provenance lines (INTERNAL_PROVENANCE_LINE) some of them carry — mirror
 * docs describe the monorepo, where the sync pipeline is on-topic. Returns
 * null when nothing but scaffolding (headings, blank runs, table separators)
 * survives — `mirror()` then skips the file entirely instead of shipping a
 * husk.
 */
export function renderAiMirror(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !INTERNAL_ONLY_LINE.test(line) && !INTERNAL_PROVENANCE_LINE.test(line));
  const hasContent = lines.some(
    (line) => !/^\s*$/.test(line) && !/^\s*#/.test(line) && !/^\s*\|?[\s:|-]+\|?\s*$/.test(line),
  );
  if (!hasContent) return null;
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * .env.example variant for sub-repos: drop the SUBREPO_* / SUBREPO_HOME sync
 * plumbing — buyers have no use for the monorepo's sync remotes.
 */
export function renderEnvExample(text) {
  const lines = text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/SUBREPO_|Sub-repo sync|sync:subrepos|origin remote's org|sibling checkouts/.test(line),
    );
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Root files rendered instead of copied verbatim. */
export const ROOT_FILE_RENDERERS = {
  ".env.example": renderEnvExample,
  "AGENTS.md": renderAgentsMd,
};

/**
 * DeepWiki steering: maps each `.devin/wiki.json` page title to what ships it.
 * "*" goes to every sub-repo; a top-level dir (`apps/web`, `packages/db`, …)
 * ships only when that dir is in the repo's file manifest (app + package
 * closure). Titles absent here are monorepo-only and never ship.
 */
const WIKI_PAGE_SHIP = {
  "Architecture Overview": "*",
  "Web Application": "apps/web",
  "Mobile Application": "apps/mobile",
  "Desktop Shell": "apps/desktop",
  "Shared Packages": "*",
  "Operations & Deployment": "*",
  "Auth & Sessions": "apps/web",
  "AI Routing, Budgets & BYOK": "apps/web",
  "Public REST API & API Keys": "apps/web",
  "MCP Server": "apps/web",
  "Billing Providers & Entitlement Ledger": "apps/web",
  "Settings & Workspace Administration": "apps/web",
  "Custom Domains & White Label": "apps/web",
  "Theming, Blocks & Layouts": "apps/web",
  "SEO & Marketing Surface": "apps/web",
  Internationalization: "apps/web",
  "Email & Transactional Delivery": "apps/web",
  "Webhooks & Outbound Events": "apps/web",
  "Server Configuration": "packages/config",
  "Database, Schema & Migrations": "packages/db",
  "AI Provider Layer": "packages/ai",
  "Agent Framework Adapters": "packages/agents",
  "Billing Adapter Contracts": "packages/billing",
  "Email Transports": "packages/email",
  "Jobs & Background Work": "packages/jobs",
  "Object Storage": "packages/storage",
  "UI Packages & Design Tokens": "packages/design-tokens",
  Observability: "packages/observability",
  "Mobile BFFs & Native Purchases": "apps/mobile",
  "Supabase Deployment": "*",
};

/**
 * Per-repo `.devin/wiki.json`: only the pages whose ship key is in the repo's
 * file manifest. Pages whose parent was filtered out are reparented to the
 * nearest surviving ancestor (or made roots), so parent references always
 * resolve. `wiki` is the parsed monorepo steering file; `files` is the
 * repo-relative manifest from buildFileManifest.
 */
export function renderWikiJson(wiki, files) {
  const shippedDirs = new Set(files.map((f) => f.split("/").slice(0, 2).join("/")));
  const shipped = new Map();
  for (const page of wiki.pages ?? []) {
    const key = WIKI_PAGE_SHIP[page.title];
    if (key === "*" || (key !== undefined && shippedDirs.has(key))) {
      shipped.set(page.title, page);
    }
  }
  const parentOf = new Map((wiki.pages ?? []).map((page) => [page.title, page.parent ?? null]));
  const resolveParent = (title) => {
    let cursor = parentOf.get(title) ?? null;
    while (cursor !== null && !shipped.has(cursor)) {
      cursor = parentOf.get(cursor) ?? null;
    }
    return cursor;
  };
  return {
    pages: [...shipped.values()].map((page) => {
      const parent = resolveParent(page.title);
      return {
        purpose: page.purpose,
        title: page.title,
        ...(parent === null ? {} : { parent }),
      };
    }),
    repo_notes: wiki.repo_notes ?? [],
  };
}
