# scripts/sync-subrepos.mjs

> Last updated: 2026-10-06 | Protection: NORMAL

## Purpose

CLI (`pnpm sync:subrepos`) that mirrors the monorepo into the standalone
repos declared in `subrepos.json`. One-way sync — sub-repos are delivery
targets, never edited directly. Generic git plumbing + shared sync
constants live in `subrepos.mjs` (`runGit`/`git`/`gitOrThrow`/`listGit`/
`GIT_ENV`, `captureCheckoutState`/`positionBranch`/`restoreCheckoutState`/
`restoreDryRunSibling`, `ignoredPaths`/`applyShippedIgnoreRules`,
`GENERATED`, `pruneEmptyDirs`); this file keeps
only the CLI orchestration (`resolveBranch`, `siblingGuard`, `mirror`,
`stage`, `syncRepo`).

## Flow

1. Filter specs by `--only <web|mobile|desktop|full-name>`; unknown → exit 1.
2. Warn when the monorepo tree is dirty (sync copies worktree contents).
3. Per spec: work dir via `resolveWorkDir` (spec `checkout` →
   `SUBREPO_HOME/<name>` → managed `<repo>/.subrepos/<name>`, gitignored);
   skip when the dir exists non-empty but is not a git repo, or when no
   remote resolves (`SUBREPO_*_REMOTE` env → the checkout's own
   `remote.origin.url` → `deriveRemote(origin)`).
4. `git init` + `remote add` (or `set-url`) + `fetch origin`.
5. Sibling mode on a pre-existing repo without `--force` → `siblingGuard`:
   `.supastack-sync` marker required when the repo has commits, tracked
   tree must be clean, `log HEAD --not --remotes` may only contain
   `chore: sync from supastack@` subjects, no untracked file may sit at a
   synced/generated path.
6. `captureCheckoutState` snapshot → `positionBranch`: with a fetched
   `origin/<branch>` it does `checkout -f -B <branch> HEAD` + `git rebase
   origin/<branch>`, so local commits — including an unpushed sync commit
   from a previously failed push — are replayed onto the remote tip
   instead of orphaned (ancestor HEAD simply fast-forwards). Rebase
   failure → abort + `restoreCheckoutState` + warn + skip. No remote tip /
   unborn HEAD → the old `-B <branch>` forms.
7. Second `check-ignore` pass via `applyShippedIgnoreRules` — it first
   writes every `.gitignore` the manifest ships (root + nested) into the
   checkout so the pass evaluates the incoming rules, not the previous
   revision's (a stale `.ai/` rule dropped every mirror doc); ignored
   paths leave `files`. Then `mirror()` copies the `buildFileManifest`
   set — root files route through `ROOT_FILE_RENDERERS`, `.ai/*` through
   `renderAiMirror` (internal-only lines stripped; `null` husks dropped
   from the file set), the rest verbatim — then generated slim
   `package.json`, `README.md`, `llms.txt` (`renderLlmsTxt(repo, shipped)`
   — every link gated on the shipped manifest), scoped
   `.devin/wiki.json`, deterministic `.supastack-sync` marker. The
   generated files read the POST-husk file list (`shipped`, re-derived
   after `.ai` husks leave `files`), so `llms.txt` can never link a doc
   that was not written; `.devin/wiki.json` — the conditional GENERATED
   member — joins `files` and the `llms.txt` link set only when the
   monorepo has a source `.devin/wiki.json` to scope.
8. `stage()` (`add -u` + `--pathspec-from-file` of manifest + the GENERATED
   members that were actually written — a pathspec matching nothing fails
   `git add`, and `.devin/wiki.json` exists only when a source wiki does) →
   clean → "up-to-date"; else `chore: sync from supastack@<sha>` +
   `push HEAD:refs/heads/<branch>` (via `origin` when the remote came from
   the checkout, else the resolved URL).
9. `--dry-run` on a sibling restores the checkout on EVERY exit — the
   "up to date" early return, the would-commit return, AND a thrown
   mirror/stage failure (the post-positioning section sits in try/finally;
   the guarded `restoreDryRunSibling` call runs exactly once per exit —
   `dryRun && mode === "sibling"` only, managed clones skip it).
   `restoreDryRunSibling` runs
   `restoreCheckoutState` (`refs/heads/<branch>` + HEAD back), then
   `reset --hard HEAD` (or `.git/index` removal when unborn), then deletes
   the synced/`GENERATED` files the repo did not already track — refs,
   tracked contents and index end byte-identical to before; only foreign
   untracked files may remain. Managed clones are disposable and skip the
   restore.

## Important Notes

- Guard ordering is load-bearing: `siblingGuard` runs BEFORE
  `captureCheckoutState`/`positionBranch` because it inspects the
  pre-positioning state — `status --porcelain` and the foreign-commit
  probe `log HEAD --not --remotes` would answer differently after the
  rebase moves HEAD.
- Ignore-pass ordering is load-bearing too: `check-ignore` reads the
  checkout's worktree `.gitignore`, which until `mirror()` runs is the
  previous sync's revision — a stale `.ai/` rule there silently dropped
  every mirror doc from `files`. `applyShippedIgnoreRules` pre-writes the
  shipped `.gitignore` files (root + nested) before evaluating; `mirror()`
  rewrites them idempotently.
- Known limitation (pre-existing): `siblingGuard`/`positionBranch` protect
  only HEAD and `refs/heads/<branch>` — commits stranded on a `<branch>`
  tip that diverged from HEAD are neither seen by the guard probe nor
  preserved by the `-B` reset on the success path (recoverable via
  reflog). Keep sibling checkouts on the sync branch.
- Never run for real from an agent session: `subrepos.json` `checkout`
  paths resolve to real checkouts next to this repo — tests and fixtures
  must stay under `os.tmpdir()`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | `mirror()` re-derives the sorted list after `.ai` husks leave `files` and uses it for `package.json`/`llms.txt` (was the pre-husk `sorted`); `.devin/wiki.json` joins `files` only when a source wiki exists so the llms.txt link never dangles; `stage()` pathspec skips unwritten GENERATED members | Devin |
| 2026-10-06 | `mirror()` writes generated `llms.txt` after `README.md` (`llms.txt` joined `GENERATED` in the library) | Devin |
| 2026-09-27 | Second ignore pass moved to `applyShippedIgnoreRules` in `subrepos.mjs` — pre-writes shipped `.gitignore` files into the checkout before `check-ignore` so the pass evaluates the rules about to ship, not the previous revision (a stale `.ai/` rule had dropped all `.ai` mirror docs from `files`) | Devin |
| 2026-09-27 | Git plumbing moved to `subrepos.mjs` exports; positioning preserves local commits via rebase onto `origin/<branch>` (was `checkout -B <branch> origin/<branch>`, which orphaned unpushed sync commits); rebase failure and `--dry-run` now restore refs via `restoreCheckoutState`, not just file contents | Devin |
| 2026-09-27 | Sibling dry-run restore hoisted into `restoreDryRunSibling` and called on every dry-run sibling exit — the "up to date" early return had skipped it, leaving refs rewired; `GENERATED`/`pruneEmptyDirs` moved to the library | Devin |
| 2026-09-27 | Post-positioning section wrapped in try/finally so a thrown `mirror()`/`stage()` failure on a sibling dry-run also unwinds refs (guarded `restoreDryRunSibling` — it can throw via `gitOrThrow`/`fs.rm`, so the finally catches to avoid masking the real error) | Devin |
| 2026-09-26 | `mirror()` routes `.ai/*` through `renderAiMirror` — internal-only lines stripped, husk docs removed from the staged file set | Devin |
| 2026-09-22 | Writes generated `.devin/wiki.json` per sub-repo (GENERATED set) — monorepo `.devin/` never copied verbatim | Devin |
| 2026-09-20 | `SUBREPO_HOME` staging override; `tryGit` silences probe stderr | Devin |
| 2026-09-20 | Created for the Tauri/subrepos spec (Part 2) | Devin |
