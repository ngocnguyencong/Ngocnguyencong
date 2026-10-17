# scripts/subrepos.mjs (+ subrepos.json)

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

The curated root manifest includes `docs/aws-ses.md` and its matching `.ai` mirror for every platform, so SDK/SMTP setup instructions remain available in buyer checkouts.

Windows repair: the Web build uses the portable Turbo launcher and its
`extraPaths` ships that helper. Other targets retain their app-specific builds.

Testable library + config describing how each sub-repo
(`supastack-web|mobile|desktop`) is assembled from the monorepo:
manifest/render helpers are pure (explicit `root`, deterministic output);
the generic git plumbing and checkout positioning take explicit `cwd`/args
so tests can drive real temp repos — `GIT_ENV` is the only baked-in
process state (a safety default, not config).

## What It Does

- Git plumbing + checkout positioning (lifted from `sync-subrepos.mjs`):
  - `GIT_ENV` — child env for git: inherited env + `GIT_TERMINAL_PROMPT=0`.
  - `runGit(cwd, args, secret?, input?)` — non-throwing exec →
    `{ok, status, out, err}`; `secret` scrubbed from captured output before
    it can reach logs.
  - `git(cwd, args)` / `gitOrThrow(cwd, args, secret?)` / `listGit(cwd, args)`
    — trimmed-stdout-or-`null` / throw-on-failure (sanitized stderr) /
    lines-or-`[]` wrappers.
  - `captureCheckoutState(work, branch)` — `{headSha, headBranch, branchSha}`
    snapshot (each nullable; `headBranch` is the short symbolic-ref of HEAD,
    readable even when unborn).
  - `positionBranch(work, branch, {remote, warn})` — fetched `origin/<branch>`
    + born HEAD → `checkout -f -B <branch> HEAD` + `git rebase
    origin/<branch>`: local commits (incl. an unpushed `chore: sync`) replay
    onto the remote tip instead of being orphaned; an ancestor HEAD simply
    fast-forwards. Rebase failure → abort + `restoreCheckoutState` + warn +
    `false`. No remote tip → `-B <branch> HEAD`; unborn + tip → old
    `-B <branch> origin/<branch>`; both null → `-B <branch>`.
  - `restoreCheckoutState(work, branch, state, {remote, warn})` — best-effort
    restore from a snapshot: `update-ref` `refs/heads/<branch>` back to
    `branchSha` (delete when absent before), HEAD back to `headBranch`
    (`symbolic-ref` fallback for an unborn target) or detached `headSha`,
    then `reset --hard` when HEAD resolves. Never throws; used on rebase
    failure and for the `--dry-run` sibling restore.
  - `restoreDryRunSibling(work, branch, state, {files, prevTracked, remote,
    warn})` — full sibling dry-run unwind called on EVERY dry-run sibling
    exit (the "up to date" return included): `restoreCheckoutState` →
    `reset --hard`/`.git/index` drop → synced + `GENERATED` files not in
    `prevTracked` removed with emptied parents. Foreign untracked files
    survive; managed clones skip it.
  - `GENERATED` — root files generated on every sync (`package.json`,
    `README.md`, `llms.txt`, `.supastack-sync`, `.devin/wiki.json`);
    `pruneEmptyDirs` removes emptied parent dirs inside a checkout.
    `.devin/wiki.json` is the conditional member — written only when the
    monorepo has a source wiki, so its `llms.txt` link keys off literal
    `files` membership rather than GENERATED.
- `workspacePackageMap(root)` — name → repo-relative dir for `apps/*` + `packages/*`.
- `packageClosure(root, appDir)` — transitive `workspace:*` deps (deps/devDeps/peerDeps).
- `deriveRemote(originUrl, name)` — same-org remote for https/ssh origins.
- `resolveWorkDir(root, spec, {env})` — `{dir, mode}`: `spec.checkout` →
  `env.SUBREPO_HOME/<name>` → `.subrepos/<name>` ("sibling" vs "managed").
- `resolveRemote(spec, {env, originUrl, siblingOrigin})` — env override →
  sibling checkout's own origin → derived same-org URL.
- `buildFileManifest(root, spec)` — app dir + dep closure + curated root files +
  `extraPaths`; excludes node_modules/dist/.next/.expo/.turbo/target/gen/build/
  coverage/out + `*.tsbuildinfo`. Then adds each shipped file's `.ai` mirror
  doc (strip-ext / append / dotfile-strip candidates, first hit) plus
  `.ai/PROJECT_CONTEXT.md`; `.ai/README.md` is excluded. (Caller additionally
  drops gitignored paths via `git check-ignore`.)
- `renderRootPackageJson(rootPkg, spec, files?)` — standalone root manifest
  (keeps turbo/vitest/eslint/prettier/ts toolchain, drops changesets/playwright/
  smoke; `spec.scripts` overrides per repo; when `files` contains no
  `*.test.*`, `test*` scripts are dropped and standalone test-script commands
  are removed from `check`'s/`check:local`'s `&&` chain, including
  `corepack pnpm test` — vitest upstream uses `passWithNoTests: false`).
  Emits `license: "SEE LICENSE IN LICENSE.md"` pointing at the shipped
  LICENSE.md. `KEEP_SCRIPTS` gained `check:local`/`typecheck:local`
  (2026-10-06) — shipped AGENTS.md/prompts name them and both run verbatim
  downstream; `verify:*`/`typecheck:desktop`/`test:e2e*` still never ship
  (Playwright/Rust).
- Buyer-facing renders (sub-repos are forked by buyers):
  - `renderReadme(spec)` — fork-friendly README (quickstart, layout, provenance
    via `.supastack-sync`, `## License` pointing at `LICENSE.md`); explicitly
    invites editing and points agents at `llms.txt` first.
  - `renderLlmsTxt(spec, files)` — generated `llms.txt` (llmstxt.org): repo
    name + per-app flavor blockquote, then sections gated on the shipped
    manifest — start-here anchors, agent setup/deploy links (incl.
    Dockerfile/compose only when they ship), remaining `docs/*.md` as
    Guides, `prompts/*.md` as Agent prompts, `packages/*` rows, and
    Optional siblings; Security protocols is always emitted but its
    `pnpm supabase:doctor --fix-rls` mention only appears where
    `scripts/supabase-doctor.mjs` ships (web), other flavors describing the
    RLS outcome instead. Pure: no fs reads; GENERATED paths count as
    shipped except `.devin/wiki.json` (conditional — see above).
  - `renderAgentsMd(text)` — strips monorepo-only lines (`Sub-repos (` bullet
    plus anything matching `INTERNAL_ONLY_LINE`); the `.ai/` memory rule
    survives now that `.ai` docs ship.
  - `renderAiMirror(text)` — the `.ai/` transit scrub: drops
    `INTERNAL_ONLY_LINE` lines, collapses blank runs, returns `null` for
    husk docs (headings/separators only) so `mirror()` skips them.
  - `renderEnvExample(text)` — strips `SUBREPO_*`/`SUBREPO_HOME` sync plumbing.
  - `ROOT_FILE_RENDERERS` maps root files to these renders; `.ai/*` paths get
    `renderAiMirror`; everything else is copied verbatim.

## Important Notes / NEVER Change

- `positionBranch` replaced `checkout -f -B <branch> origin/<branch>`, which
  silently orphaned local commits (an unpushed `chore: sync` left by a
  failed push). `restoreCheckoutState` is the shared unwind — rebase
  failure and `--dry-run` both end refs/HEAD/tracked files byte-identical.
  `update-ref` move/delete works on a checked-out branch; an unborn restore
  needs `symbolic-ref`, not `checkout`.
- Guard ordering is load-bearing: `siblingGuard` lives in the CLI and must
  run BEFORE `captureCheckoutState`/`positionBranch` — its porcelain and
  `log HEAD --not --remotes` foreign-commit probes read the pre-positioning
  state and answer differently after a rebase.
- Known limitation (pre-existing): snapshot/restore protects HEAD and
  `refs/heads/<branch>` only — a `<branch>` tip diverged from HEAD is still
  reset by `-B` on the success path (reflog-recoverable) and the guard
  probe sees only the current branch. Keep sibling checkouts on the sync
  branch.
- `subrepos.json` names are a fulfillment contract (AGENTS.md) — renaming
  changes the repos buyers are invited to.
- `checkout` fields point at the user's real clones — the
  sync treats them as user-owned checkouts (see sync-subrepos guards).
- Eslint runs with no env globals: import `process`/`console`/`URL` etc. from
  `node:*` explicitly in these scripts.
- Root `package.json`/`README.md` are *generated*, never copied — keep them out
  of `ROOT_FILES`.

## Agent Decisions / Thoughts

- **2026-09-28 Codex:** Split the composed script at `&&` and filter only
  standalone pnpm test-script invocations, with or without Corepack. Matching
  a whole command avoids leaving a call to a dropped script and preserves
  every other check step in order. No sync checkout was touched.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-09-28 | Desktop buyer `check` called a removed `test` script after root switched to Corepack | no-tests cleanup matched only literal ` && pnpm test` | filter standalone pnpm/Corepack test commands from the check chain |
| 2026-09-27 | A `--dry-run` that found no staged changes left a sibling checkout rewired — HEAD switched, `refs/heads/<branch>` moved, rebased SHAs | the "up to date" `diff --cached --quiet` early return ran before the dry-run restore block | shared `restoreDryRunSibling` hoisted and called on every dry-run sibling exit (up-to-date and would-commit); rebase unwind gained `--abort`→`--quit` fallback |
| 2026-09-27 | `checkout -f -B <branch> origin/<branch>` silently orphaned local commits (incl. an unpushed sync commit after a failed push); `--dry-run` restored file contents but not refs | hard reset to remote tip; no pre-move ref snapshot | `captureCheckoutState` snapshot → `positionBranch` rebases local commits onto the remote tip; `restoreCheckoutState` unwinds refs/HEAD on rebase conflict and dry-run |
| 2026-09-20 | `.supastack-sync` forced a commit every run | embedded `syncedAt` timestamp | marker is now deterministic `{sha, dirty?}` |
| 2026-09-20 | Sync wasn't connected to real sibling checkouts; `git add -A` failed on ignored manifest paths (`.impeccable`) and could sweep foreign untracked files | staging-only design + walk ignored gitignore | `checkout`/`SUBREPO_HOME` sibling mode + `check-ignore` manifest filter + pathspec-limited staging |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-06 | `KEEP_SCRIPTS` += `check:local`/`typecheck:local`; `renderLlmsTxt` gates `supabase:doctor` mention + `.devin/wiki.json` link on what actually ships; web manifest gains `scripts/supabase-{doctor,provision}.mjs` + script entries, mobile/desktop lose `docs/agent-setup.md`; `mirror()` uses the post-husk file list for generated docs; shipped-text consistency tests added | Devin |
| 2026-10-06 | `llms.txt` joins `GENERATED`; +`renderLlmsTxt(spec, files)` (links gated on the shipped manifest); `renderReadme` gains the llms.txt bullet + agent pointer; `subrepos.json` extraPaths now ship curated `docs/*.md` (+ `prompts/` on web) | Devin |
| 2026-10-03 | `LICENSE.md` added to `ROOT_FILES`; `renderRootPackageJson` emits the license pointer; `renderReadme` gains `## License` | Devin |
| 2026-09-28 | Rendered no-tests manifests omit Corepack-wrapped test steps from `check` | Codex |
| 2026-09-27 | `GENERATED`/`pruneEmptyDirs` lifted from the CLI; +`restoreDryRunSibling` — sibling dry-run restore now runs on every dry-run exit (incl. "up to date"); rebase unwind gained `--abort`→`--quit` fallback | Devin |
| 2026-09-27 | Git plumbing (`GIT_ENV`/`runGit`/`git`/`gitOrThrow`/`listGit`) lifted from `sync-subrepos.mjs` into exports; +`captureCheckoutState`/`positionBranch`/`restoreCheckoutState` — local commits preserved via rebase onto remote tip; checkout state restored on conflict + dry-run | Devin |
| 2026-09-26 | `.ai` mirror docs ship for shipped files (scrubbed by `renderAiMirror` in transit); `renderAgentsMd` keeps the `.ai/` rule | Devin |
| 2026-09-20 | Initial implementation + `tests/subrepos.test.ts` (9 tests) | Devin |
| 2026-09-20 | Sibling checkouts (`checkout`/`SUBREPO_HOME`), remote precedence via sibling origin, buyer-facing renders (README/AGENTS/.env.example), test-aware package.json render (18 tests) | Devin |

Release sync repair: the three filtered text renderers split both LF and CRLF input before blank-line collapse. This prevents local Windows sync and Linux automation from repeatedly adding/removing a blank line after stripped content. Regression tests failed before the fix; all 47 focused sync/documentation tests, targeted lint, and formatting passed.
