# scripts/sync-subrepos.mjs

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

CLI (`pnpm sync:subrepos`) that mirrors the monorepo into the three standalone
sub-repos declared in `scripts/subrepos.json`. Sub-repos are forked by buyers —
keep their content buyer-clean.

## What It Does

Per repo (`syncRepo`):

1. `resolveWorkDir` → **sibling** mode when `spec.checkout`
   or `SUBREPO_HOME` resolves to a real checkout; else **managed** staging clone
   under `.subrepos/` (CI/fallback).
2. Remote = `SUBREPO_*_REMOTE` env → sibling's own `origin` → derived same-org
   URL (`resolveRemote`). Missing → warn+skip.
3. Existing dir without `.git` and non-empty → skip (never wipe a stranger dir);
   missing/empty dir → `git init` + `remote add` there.
4. `fetch origin` (failure warns + skips that repo, others continue).
5. Sibling guards (`siblingGuard`, skipped with `--force`): tracked dirty →
   skip; local commits on HEAD whose subjects aren't `chore: sync from
   supastack@*` → skip; commits exist but no `.supastack-sync` marker → skip
   (not a sync target); untracked file at a synced path → skip.
6. `captureCheckoutState` snapshot (`{headSha, headBranch, branchSha}` — each
   nullable; `headBranch` is readable even when HEAD is unborn), then
   `positionBranch` puts the checkout on `branch` (`resolveBranch`: remote
   default → main/master → new `main`) WITHOUT losing local commits:
   fetched `origin/<branch>` + born HEAD → `checkout -f -B <branch> HEAD` +
   `git rebase origin/<branch>` — unpushed sync commits (and `--force`
   sibling foreign commits) replay onto the remote tip; an ancestor HEAD
   just fast-forwards. Rebase failure → `rebase --abort` +
   `restoreCheckoutState` (snapshot restored) + warn + skip — never left
   mid-rebase or with moved refs. Unborn HEAD + remote tip → old
   `-B <branch> origin/<branch>`; no remote tip + born HEAD →
   `-B <branch> HEAD`; both null → `-B <branch>`.
7. Mirror: managed mode wipes all but `.git`; sibling mode deletes only
   previously-tracked files absent from the new manifest (untracked user files,
   `node_modules`, `.env` survive). Manifest is additionally filtered through
   `git check-ignore` so monorepo-ignored files (`.env`, `.impeccable`, …) are
   never copied — secrets can't reach sub-repo remotes. Root files listed in
   `ROOT_FILE_RENDERERS` are rendered (AGENTS.md/.env.example buyer variants).
8. Write generated `package.json` (drops test scripts when no `*.test.*` in
   manifest), buyer-facing `README.md`, `llms.txt` (agent entry map —
   `renderLlmsTxt` links only paths in the shipped manifest),
   `.supastack-sync` marker.
9. Stage **only** the managed set: `git add -u` + `git add
   --pathspec-from-file=.git/supastack-sync.paths` — foreign untracked files
   can never be swept into the sync commit.
10. Empty staged diff → "up to date"; else commit
    `chore: sync from supastack@<sha>` + push (`-u origin` when pushing to the
    checkout's own remote, else explicit URL).

Flags: `--only web|mobile|desktop`, `--dry-run` (sibling checkouts are fully
restored on EVERY dry-run exit via a guarded `restoreDryRunSibling` in
try/finally — "up to date", would-commit, AND thrown mirror/stage failures,
since positioning already moved refs: `restoreCheckoutState` puts
`refs/heads/<branch>` + the HEAD position back first, then `reset --hard` +
our copied files removed — refs, tracked contents and index end
byte-identical; unborn-HEAD repos drop `.git/index` instead), `--force`
(skip sibling guards).
`GIT_TERMINAL_PROMPT=0` so hooks/CI never hang on credential prompts.

## Important Notes / NEVER Change

- Remote URLs containing credentials are scrubbed from all git stderr (`***`);
  CI passes `x-access-token` URLs via env.
- The marker must stay deterministic (no timestamps) or every run commits.
- Sync mirrors the *worktree*, not HEAD — warn on dirty trees (already does).
- One-way only: sub-repos are sync targets, never edited (AGENTS.md). Buyers
  fork them and write code — never add monorepo-internal tooling files to the
  manifest.

## Open Threads / Resume Context

- Real sibling checkouts of the three platform repos sit next to this
  monorepo — connected via `checkout` in subrepos.json; earlier push proved
  credentials work.
- Local smoke test used bare repos under `tmp/subrepo-e2e/` (deleted).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | `mirror()` also writes generated `llms.txt` (in `GENERATED`, staged via the pathspec file); `extraPaths` now carries curated docs/prompts so buyer checkouts are agent-readable | Devin |
| 2026-09-27 | Sibling dry-run restore moved into try/finally — a thrown mirror/stage failure now also unwinds sibling refs, not just the two normal exits | Devin |
| 2026-09-27 | `--dry-run` sibling restore hoisted to `restoreDryRunSibling` and now runs on every dry-run exit — the "up to date" early return had skipped it, leaving sibling refs rewired | Devin |
| 2026-09-27 | Git plumbing moved to `subrepos.mjs` exports; step 6 became `captureCheckoutState` → `positionBranch` (rebase onto remote tip preserves unpushed local commits; conflict → abort + restore + skip); `--dry-run` now restores refs/HEAD too, not just files | Devin |
