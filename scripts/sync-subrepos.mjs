#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { error, log, warn } from "node:console";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import {
  applyShippedIgnoreRules,
  buildFileManifest,
  captureCheckoutState,
  GENERATED,
  git,
  gitOrThrow,
  GIT_ENV,
  ignoredPaths,
  listGit,
  positionBranch,
  pruneEmptyDirs,
  renderAiMirror,
  renderLlmsTxt,
  renderReadme,
  renderRootPackageJson,
  renderWikiJson,
  resolveRemote,
  resolveWorkDir,
  restoreDryRunSibling,
  ROOT_FILE_RENDERERS,
  runGit,
} from "./subrepos.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const force = argv.includes("--force");
const onlyIndex = argv.indexOf("--only");
const only = onlyIndex >= 0 ? argv[onlyIndex + 1] : null;

/** Commit subjects the sync itself produces — safe to re-base over. */
const SYNC_COMMIT = /^chore: sync from supastack@/;

/** Branch to mirror onto: remote default → main/master → new "main". */
function resolveBranch(work) {
  git(work, ["remote", "set-head", "origin", "--auto"]);
  const head = git(work, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (head) return head.replace(/^origin\//, "");
  for (const candidate of ["main", "master"]) {
    if (git(work, ["rev-parse", "--verify", `origin/${candidate}`]) !== null) {
      return candidate;
    }
  }
  return "main";
}

/**
 * Guard a user-owned sibling checkout before touching it. Returns a skip
 * reason, or null when the checkout is safe to mirror into. Only files git
 * already tracks are ever deleted; untracked foreign files are never staged
 * (staging is pathspec-limited to the manifest), so they neither block nor
 * leak into the sync commit.
 */
function siblingGuard(work, files) {
  const hasCommits = git(work, ["rev-parse", "--quiet", "--verify", "HEAD"]) !== null;
  if (hasCommits && git(work, ["cat-file", "-e", "HEAD:.supastack-sync"]) === null) {
    return "repo has commits but no .supastack-sync marker — not a sync target";
  }
  if (listGit(work, ["status", "--porcelain", "-uno"]).length > 0) {
    return "checkout has uncommitted tracked changes — commit/stash them or pass --force";
  }
  const foreign = listGit(work, ["log", "--format=%s", "HEAD", "--not", "--remotes"]).filter(
    (subject) => !SYNC_COMMIT.test(subject),
  );
  if (foreign.length > 0) {
    return `checkout has local commit(s) not made by sync (e.g. "${foreign[0]}") — refusing to rebase`;
  }
  const overwrite = listGit(work, ["ls-files", "--others", "--exclude-standard"]).find(
    (f) => files.has(f) || GENERATED.has(f),
  );
  if (overwrite) {
    return `untracked file "${overwrite}" sits at a synced path — refusing to overwrite`;
  }
  return null;
}

async function mirror(work, files, repo, { rootPkg, sha, dirty, mode, prevTracked }) {
  if (mode === "managed") {
    // Our own staging clone — wipe everything but .git.
    for (const entry of await fs.readdir(work)) {
      if (entry !== ".git") await fs.rm(path.join(work, entry), { force: true, recursive: true });
    }
  } else {
    // User-owned checkout — delete only files tracked by the last sync.
    for (const rel of prevTracked) {
      if (files.has(rel) || GENERATED.has(rel)) continue;
      await fs.rm(path.join(work, rel), { force: true });
      await pruneEmptyDirs(work, rel);
    }
  }
  const sorted = [...files].sort();
  for (const rel of sorted) {
    const dest = path.join(work, rel);
    const render = ROOT_FILE_RENDERERS[rel];
    if (render) {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, render(await fs.readFile(path.join(ROOT, rel), "utf8")));
    } else if (rel.startsWith(".ai/")) {
      // Mirror docs ship scrubbed; a doc reduced to headings/separators is
      // a husk — drop it from the file set so it is neither written nor
      // staged downstream.
      const scrubbed = renderAiMirror(await fs.readFile(path.join(ROOT, rel), "utf8"));
      if (scrubbed === null) {
        files.delete(rel);
        continue;
      }
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, scrubbed);
    } else {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(path.join(ROOT, rel), dest);
    }
  }
  // `.ai` husks were dropped from `files` during the loop above — re-derive
  // the post-husk list so the generated package.json/llms.txt never
  // reference a file that is not actually written.
  const shipped = [...files].sort();
  await fs.writeFile(
    path.join(work, "package.json"),
    `${JSON.stringify(renderRootPackageJson(rootPkg, repo, shipped), null, 2)}\n`,
  );
  await fs.writeFile(path.join(work, "README.md"), renderReadme(repo));
  // Per-repo DeepWiki steering — never a verbatim copy of the monorepo's
  // .devin/: only the pages whose code actually ships in this repo. The
  // file is generated only when the monorepo has a source wiki, so it joins
  // the llms.txt link set (and `files`) only in that case.
  const wiki = await fs.readFile(path.join(ROOT, ".devin", "wiki.json"), "utf8").catch(() => null);
  if (wiki !== null) files.add(".devin/wiki.json");
  // llms.txt — the agent entry map; renderLlmsTxt links only paths that ship.
  await fs.writeFile(
    path.join(work, "llms.txt"),
    renderLlmsTxt(repo, wiki === null ? shipped : [...shipped, ".devin/wiki.json"]),
  );
  if (wiki !== null) {
    const scoped = renderWikiJson(JSON.parse(wiki), shipped);
    await fs.mkdir(path.join(work, ".devin"), { recursive: true });
    await fs.writeFile(
      path.join(work, ".devin", "wiki.json"),
      `${JSON.stringify(scoped, null, 2)}\n`,
    );
  }
  // Deterministic marker: no timestamp — a changed file every run would force
  // a commit even when nothing else moved, breaking the up-to-date check.
  await fs.writeFile(
    path.join(work, ".supastack-sync"),
    `${JSON.stringify(
      {
        sha,
        source: "supastack",
        note: "Provenance marker written by the supastack monorepo sync — safe to ignore.",
        ...(dirty ? { dirty } : {}),
      },
      null,
      2,
    )}\n`,
  );
}

/**
 * Stage exactly the managed file set — tracked edits/deletions plus the
 * manifest — so untracked foreign files in a sibling checkout (local lockfiles,
 * scratch notes, .env) are never swept into the sync commit.
 */
async function stage(work, files, remote) {
  gitOrThrow(work, ["add", "-u"], remote);
  // GENERATED members are staged only when actually written —
  // `.devin/wiki.json` exists solely when the monorepo ships a source wiki,
  // and `add --pathspec-from-file` fails on a path that matches nothing.
  const staged = [...files];
  for (const rel of GENERATED) {
    if (existsSync(path.join(work, rel))) staged.push(rel);
  }
  const specFile = path.join(work, ".git", "supastack-sync.paths");
  await fs.writeFile(specFile, staged.join("\n"));
  gitOrThrow(work, ["add", "--pathspec-from-file=.git/supastack-sync.paths"], remote);
}

async function syncRepo(repo, ctx) {
  const { originUrl } = ctx;
  const { dir: work, mode } = resolveWorkDir(ROOT, repo, { env: process.env });
  const relWork = path.relative(ROOT, work) || work;
  const preExisting = existsSync(path.join(work, ".git"));

  if (existsSync(work) && !preExisting && (await fs.readdir(work)).length > 0) {
    warn(`[${repo.name}] skipped — ${relWork} exists but is not a git repo`);
    return false;
  }

  const siblingOrigin = preExisting ? git(work, ["config", "--get", "remote.origin.url"]) : null;
  const remote = resolveRemote(repo, { env: process.env, originUrl, siblingOrigin });
  if (!remote) {
    warn(`[${repo.name}] skipped — set ${repo.remoteEnv} or configure remote.origin.url`);
    return false;
  }
  const displayRemote = remote.replace(/:\/\/[^@/\s]+@/, "://***@");
  log(`[${repo.name}] syncing ${relWork} (${mode}) → ${displayRemote}`);

  const manifest = await buildFileManifest(ROOT, repo);
  const localIgnored = ignoredPaths(ROOT, manifest, { warn });
  const files = new Set(manifest.filter((f) => !localIgnored.has(f)));

  if (preExisting) {
    gitOrThrow(work, ["remote", "set-url", "origin", remote], remote);
  } else {
    execFileSync("git", ["init", work], { env: GIT_ENV, stdio: "inherit" });
    gitOrThrow(work, ["remote", "add", "origin", remote], remote);
  }

  const fetched = runGit(work, ["fetch", "origin"], remote);
  if (!fetched.ok) {
    warn(`[${repo.name}] skipped — fetch from ${displayRemote} failed: ${fetched.err}`);
    return false;
  }

  if (mode === "sibling" && preExisting && !force) {
    const reason = siblingGuard(work, files);
    if (reason) {
      warn(`[${repo.name}] skipped — ${reason}`);
      return false;
    }
  }

  // Capture the checkout state before positioning moves anything — the
  // dry-run sibling restore below puts refs back exactly. positionBranch
  // keeps local commits (incl. unpushed sync commits) by rebasing them onto
  // the fetched remote tip instead of hard-resetting to it.
  const branch = resolveBranch(work);
  const checkoutState = captureCheckoutState(work, branch);
  if (!positionBranch(work, branch, { remote, warn })) {
    warn(`[${repo.name}] skipped — could not replay local commits onto origin/${branch}`);
    return false;
  }

  // Positioning already moved refs, so on a sibling dry-run EVERY exit —
  // "up to date", "would commit", or a thrown mirror/stage failure —
  // unwinds the checkout back to the captured state exactly once via the
  // finally below (guarded: restoreDryRunSibling can throw via gitOrThrow
  // /fs.rm, and a finally throw would mask the real error). Managed clones
  // are disposable and never reach the guarded call.
  const prevTracked = new Set(listGit(work, ["ls-files"]));
  const restoreSibling = () =>
    restoreDryRunSibling(work, branch, checkoutState, { files, prevTracked, remote, warn });
  try {
    // Second ignore pass against the *target* index — but it must evaluate
    // the ignore rules the sync is about to commit, not the checkout's
    // previous .gitignore revision (stale checkouts still ignored `.ai/` and
    // would drop every mirror doc here). applyShippedIgnoreRules pre-writes
    // the shipped .gitignore files; mirror() rewrites them idempotently
    // below. Anything still ignored would fail `git add` or leak.
    await applyShippedIgnoreRules(work, files, { root: ROOT, warn });

    await mirror(work, files, repo, { ...ctx, mode, prevTracked });
    await stage(work, files, remote);
    const stat = git(work, ["diff", "--cached", "--stat"]);
    if (git(work, ["diff", "--cached", "--quiet"]) !== null) {
      log(`[${repo.name}] up to date`);
      return true;
    }
    if (dryRun) {
      log(`[${repo.name}] dry-run — would commit:\n${stat}`);
      return true;
    }
  } finally {
    if (dryRun && mode === "sibling") {
      try {
        await restoreSibling();
      } catch (e) {
        warn(`[${repo.name}] warning: dry-run restore failed — ${e.message}`);
      }
    }
  }

  gitOrThrow(work, ["commit", "-m", `chore: sync from supastack@${ctx.sha}`], remote);
  const pushTarget = remote === siblingOrigin ? "origin" : remote;
  const pushArgs =
    pushTarget === "origin"
      ? ["push", "-u", "origin", `HEAD:refs/heads/${branch}`]
      : ["push", pushTarget, `HEAD:refs/heads/${branch}`];
  const push = runGit(work, pushArgs, remote);
  if (!push.ok) {
    warn(`[${repo.name}] push failed — ${push.err || push.out}`);
    return false;
  }
  log(`[${repo.name}] pushed ${branch}`);
  return true;
}

const config = JSON.parse(await fs.readFile(new URL("./subrepos.json", import.meta.url), "utf8"));
const originUrl = git(ROOT, ["config", "--get", "remote.origin.url"]);
const sha = git(ROOT, ["rev-parse", "--short", "HEAD"]) ?? "unknown";
const dirty = (git(ROOT, ["status", "--porcelain"]) ?? "").length > 0;
const rootPkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));

if (dirty) {
  warn("[subrepos] warning: working tree is dirty — syncing worktree contents");
}

const selected = config.repos.filter(
  (repo) => !only || repo.name === only || repo.name === `supastack-${only}`,
);
if (selected.length === 0) {
  error(`[subrepos] no repo matches --only ${only ?? ""}`);
  process.exit(1);
}
let failed = 0;
for (const repo of selected) {
  try {
    if (!(await syncRepo(repo, { sha, dirty, rootPkg, originUrl }))) failed += 1;
  } catch (e) {
    warn(`[${repo.name}] failed — ${e.message}`);
    failed += 1;
  }
}
if (failed > 0) {
  error(`[subrepos] ${failed} repo(s) not synced`);
  process.exit(1);
}
