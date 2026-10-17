# scripts/subrepos.mjs

> Last updated: 2026-10-10 | Protection: NORMAL

## Purpose

`docs/aws-ses.md` is a curated root file shipped with its matching `.ai` mirror to all three platform checkouts.

Testable library behind `sync-subrepos.mjs`. Manifest/render helpers are
pure (explicit `root`, deterministic output); the generic git plumbing and
checkout-positioning functions take explicit `cwd`/args so tests can drive
real temp repos. The only baked-in process state is the `GIT_ENV`
credential-prompt safety default.

## Public API

| Export | Description |
| --- | --- |
| `GIT_ENV` | Child env for git: inherited env + `GIT_TERMINAL_PROMPT=0` (never block on credential prompts) |
| `runGit(cwd, args, secret?, input?)` | Non-throwing git exec → `{ok, status, out, err}`; `secret` scrubbed from captured output before it can reach logs |
| `git(cwd, args)` | Query wrapper — trimmed stdout, `null` on failure |
| `gitOrThrow(cwd, args, secret?)` | Command wrapper — prints sanitized stderr, throws `git <cmd> failed` on failure |
| `listGit(cwd, args)` | Query wrapper — stdout lines, `[]` on failure |
| `ignoredPaths(cwd, files, {warn})` | `check-ignore --stdin` against `cwd`'s worktree rules → Set of ignored paths; non-1 exit warns + returns empty |
| `applyShippedIgnoreRules(work, files, {root, warn})` | `syncRepo`'s second ignore pass — pre-writes every `.gitignore` in `files` (root + nested, `ROOT_FILE_RENDERERS` applied) into `work` so the check evaluates the rules about to ship, not the checkout's previous revision; deletes ignored paths from `files`, returns the dropped Set |
| `captureCheckoutState(work, branch)` | Pre-move snapshot `{headSha, headBranch, branchSha}` (each `null`-able): resolved HEAD, short symbolic-ref (readable even when unborn), `refs/heads/<branch>` tip |
| `positionBranch(work, branch, {remote, warn})` | Put `work` on `branch` without losing local commits: remote tip + born HEAD → `checkout -f -B branch HEAD` + `git rebase origin/<branch>` (ancestor → fast-forward); rebase failure → abort (`--quit` fallback) + `restoreCheckoutState` + warn + `false`. Unborn HEAD + remote tip → `-B branch origin/<branch>`; no remote tip + born HEAD → `-B branch HEAD`; both null → `-B branch` |
| `restoreCheckoutState(work, branch, state, {remote, warn})` | Best-effort restore from a `captureCheckoutState` snapshot: `update-ref` `refs/heads/<branch>` to `branchSha` (or delete when absent before), HEAD back to `headBranch` (symbolic-ref fallback for unborn) or detached `headSha`, then `reset --hard`. Never throws; used by rebase-failure and `--dry-run` restore |
| `restoreDryRunSibling(work, branch, state, {files, prevTracked, remote, warn})` | Full `--dry-run` sibling unwind — the CLI calls it on EVERY dry-run sibling exit incl. "up to date" (positioning already moved refs even when the staged diff is empty): `restoreCheckoutState` → `reset --hard HEAD` (`.git/index` dropped when HEAD is unborn) → synced + `GENERATED` files absent from `prevTracked` deleted with their emptied parent dirs. Foreign untracked files survive; managed clones skip it entirely |
| `GENERATED` | Root files generated on every sync (`package.json`, `README.md`, `llms.txt`, `.supastack-sync`, `.devin/wiki.json`) — shared by `siblingGuard`/`stage`/`mirror`/dry-run restore; `.devin/wiki.json` is the conditional member (written only when a source wiki exists) |
| `pruneEmptyDirs(work, rel)` | Remove `rel`'s emptied parent dirs inside `work`, bottom-up |
| `ROOT_FILES` | Curated root files every sub-repo ships verbatim or rendered (env example, gitignore/gitattributes/prettierignore, AGENTS.md, LICENSE.md, eslint/prettier configs, pnpm-workspace, tsconfig.base, turbo.json, vitest.config) — root `package.json`/`README.md` are generated instead |
| `workspacePackageMap(root)` | package name → dir for `apps/*` + `packages/*` |
| `packageClosure(root, appDir)` | Recursive `workspace:*` dep closure (deps/devDeps/peerDeps; app dir itself excluded) |
| `deriveRemote(originUrl, name)` | Swaps the repo-name segment of an https/ssh remote → `<org>/<name>[.git]`; null when unparseable |
| `buildFileManifest(root, spec)` | Sorted repo-relative file list: app + closure + `ROOT_FILES` + `extraPaths`, excluding build outputs/agent dirs — then adds each shipped file's `.ai` mirror doc plus `.ai/PROJECT_CONTEXT.md` |
| `renderRootPackageJson(rootPkg, spec, files?)` | Slim standalone root manifest — keeps turbo/vitest/eslint/prettier/ts toolchain, drops monorepo-only scripts; drops `test*` scripts when `files` ships no `*.test.*`; carries `license: "SEE LICENSE IN LICENSE.md"` so the generated manifest points at the shipped LICENSE.md. `KEEP_SCRIPTS` includes `check:local`/`typecheck:local` (named by shipped AGENTS.md/prompts; the `--filter=!@supastack/desktop` exclusion is harmless where desktop is absent); `verify:*`/`typecheck:desktop`/`test:e2e*` stay out — Playwright/Rust never ship |
| `resolveWorkDir(root, spec, {env})` | `{dir, mode}`: `spec.checkout` → `SUBREPO_HOME/<name>` → managed `.subrepos/<name>` |
| `resolveRemote(spec, {env, originUrl, siblingOrigin})` | env override → sibling checkout's origin → derived same-org URL |
| `renderReadme(spec)` | Fork-friendly standalone README (quickstart, layout incl. `.ai/` + `llms.txt`, provenance via `.supastack-sync`, License section pointing at `LICENSE.md`); English-only; tells agents to read `llms.txt` first |
| `renderLlmsTxt(spec, files)` | Generated `llms.txt` (llmstxt.org) — `# <name>` + per-app flavor blockquote, then manifest-gated sections (Start here — the `.env.example` note names `apps/web/.env.local` on the web flavor only, `Agent setup & deploy`/`Deploy the backend` incl. the web-only `scripts/setup-env.mjs` + `scripts/setup.mjs` local environment bootstrap/wizard and Dockerfile/compose when shipped (heading follows `docs/agent-setup.md` in the manifest), Guides from remaining `docs/*.md`, Agent prompts from `prompts/*.md`, Packages rows by dir name, Optional siblings) plus an always-emitted Security protocols list. `guideNotes`/`promptNotes` maps annotate known links with `: note` text (every-link-annotated convention); unmapped entries fall back to bare labels. Pure: array-or-Set `files` decides every link; GENERATED paths count as shipped — except `.devin/wiki.json`, which `mirror()` writes only when a source wiki exists, so its Optional link follows literal `files` membership (callers add it iff written). The Security `pnpm supabase:doctor --fix-rls` mention (audits and repairs) is likewise gated on `scripts/supabase-doctor.mjs` shipping (web only); other flavors get the RLS outcome described without naming the command. Security protocols say to generate new secrets with `openssl rand` and distinguish static log messages from redacted structured context |
| `renderAgentsMd(text)` | Buyer AGENTS.md — drops the `Sub-repos (` bullet + every `INTERNAL_ONLY_LINE` match; the `.ai/` memory rule survives because `.ai` docs now ship |
| `renderAiMirror(text)` | Scrubs `.ai` mirror docs in transit (drops `INTERNAL_ONLY_LINE` + `INTERNAL_PROVENANCE_LINE` lines, collapses 3+ blank runs); returns `null` when only headings/blanks/table separators survive → `mirror()` skips the husk |
| `renderEnvExample(text)` | Drops `SUBREPO_*`/`SUBREPO_HOME` sync plumbing |
| `ROOT_FILE_RENDERERS` | Root files rendered instead of copied verbatim (`.env.example`, `AGENTS.md`) |
| `renderWikiJson(wiki, files)` | Per-repo `.devin/wiki.json` filtered to `WIKI_PAGE_SHIP` keys in the manifest; children of filtered pages reparent to nearest surviving ancestor |
| `INTERNAL_ONLY_LINE` (module const) | Shared banned-line regex (monorepo-internal references + sync machinery) used by `renderAgentsMd`/`renderAiMirror` |
| `INTERNAL_PROVENANCE_LINE` (module const) | Stricter second banned-line regex used only by `renderAiMirror` — private maintainer org/product/remote identifiers (the upstream org names and the fixed remote name once hardcoded into guide copy), agent/branch provenance (`Devin`/`Codex` authors, `devin/`/`codex/`/`feat/`/`archive/` branches, `origin/…` remotes, internal git-state words), sync-pipeline identifiers (the module's own exports, `SUBREPO_*`, `sync:subrepos`, `.agents/`/`.github/`/`.githooks`/`tests/` paths, `docs/superpowers`, `.impeccable`), sibling-checkout vocabulary, and commands buyers cannot run (`verify:*`, `test:e2e*`, `*:desktop`, `smoke:providers`, `supabase:provision`, `pnpm verify`/`pnpm smoke`). Deliberately leaves descriptive vocabulary alone (bare `upstream`/`monorepo`/`checkout`/`local-only`/`sibling` survive) |

## Important Notes

- `renderLlmsTxt` links the shared security guide when shipped, names the
  Better Auth/Auth.js-backed BFF boundary, covers PostgREST exposure and its
  RLS/grant checks, and describes safe secret generation plus static log
  messages with redacted structured context. Native maps identify backend
  Docker/Podman/Coolify/VPS setup and its prompt as content in the web checkout;
  they never emit links to those unshipped paths.
- Security repair in progress: root dependency configuration references local patch files. Include the public `patches/` tree and matching mirrors in every platform manifest so a buyer's install can reproduce the patched dependency graph.

- Paths are workspace-relative posix strings (`apps/web`, never `apps\web`).
- Branch positioning (2026-09-27): the previous `checkout -f -B <branch>
  origin/<branch>` silently orphaned local commits — notably an unpushed
  `chore: sync from supastack@<sha>` left by a failed push. The rebase path
  preserves them; `--force` siblings keep their foreign commits the same
  way (never discard data). A failed rebase must leave the checkout in its
  pre-call state — `restoreCheckoutState` is the shared unwind and is also
  what `--dry-run` uses so refs end byte-identical, not just file contents.
- `restoreCheckoutState` ordering matters: fix `refs/heads/<branch>` first
  (update-ref move/delete works on a checked-out branch), re-point HEAD
  second (`checkout -f` only when the target ref exists — an unborn
  original branch needs `symbolic-ref`), `reset --hard` last and only when
  HEAD resolves. An unborn restore leaves `.git/index` populated — the
  caller drops it (restoreDryRunSibling does).
- Known limitation (pre-existing): the snapshot/restore protects HEAD and
  `refs/heads/<branch>` only — a `<branch>` tip that diverged from HEAD
  (e.g. the user sits on another branch while `main` holds local work) is
  still reset to HEAD by `checkout -B` on the success path (recoverable via
  reflog; conflict/dry-run restores do put the ref back). `siblingGuard`'s
  `HEAD --not --remotes` foreign-commit probe likewise sees only the
  current branch — keep sibling checkouts on the sync branch.
- Guard ordering is load-bearing in the CLI: `siblingGuard` inspects the
  pre-positioning state (`status --porcelain`, `log HEAD --not --remotes`
  for foreign subjects) and must run before `positionBranch` moves refs —
  after the rebase those probes answer differently.
- Ignore-pass ordering (2026-09-27): `check-ignore` reads the checkout's
  worktree `.gitignore`, which on a pre-existing checkout is still the
  previous sync's revision — a stale `.ai/` rule there dropped every
  mirror doc from `files` before `mirror()` could write the new rules.
  `applyShippedIgnoreRules` therefore writes each shipped `.gitignore`
  into `work` BEFORE evaluating (root + nested files like
  `apps/desktop/src-tauri/.gitignore`); `mirror()` rewrites them
  idempotently. When the manifest ships no `.gitignore`, the checkout's
  own rules apply as the fallback.
- `.ai/` shipping (2026-09-26): `buildFileManifest` resolves each shipped
  file's mirror via `aiMirrorPath` — conventions tried in order: strip last
  ext (`x.ts` → `x.md`, `package.json` → `package.md`), append
  (`.env.example` → `.env.example.md`), dotfile strip (`.gitattributes` →
  `gitattributes.md`). `.ai/PROJECT_CONTEXT.md` always ships; `.ai/README.md`
  never does (the monorepo README is regenerated downstream). Mirrors of
  unshipped files can't enter the set — no walk of `.ai/` exists.
- Buyer-clean is enforced in transit: `renderAiMirror` drops
  `INTERNAL_ONLY_LINE` matches plus the stricter `INTERNAL_PROVENANCE_LINE`
  provenance tokens from every shipped `.ai` doc — `PROJECT_CONTEXT.md`
  work-log lines (branch/remotes, unshipped commands, sync internals) never
  reach buyers while descriptive vocabulary survives. Source-side,
  `.ai` docs are repo-scoped — they never reference other repositories or
  maintainer-only checkouts.
- `renderReadme` emits an English-only README; a test asserts no Han script.
- Exclusions intentionally cover agent-local dirs so worktree state never
  leaks into the public sub-repos.
- Shipped-text consistency is guarded end-to-end by tests (2026-10-06):
  every `pnpm <name>` named in code spans of shipped docs/prompts plus the
  generated `llms.txt`/`README.md`/rendered `AGENTS.md`/`.env.example` must
  exist in that repo's generated `scripts` (pnpm builtins/bin passthroughs
  and an exact-match `KNOWN_UNSHIPPED_COMMANDS` doc-debt list aside), and
  every `scripts/*.mjs` path must be in the manifest. AGENTS.md keeps
  monorepo-only commands on `INTERNAL_ONLY_LINE`-marked lines so the synced
  copies never name a missing script.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `guideNotes` += `docs/desktop-updates.md` annotation (generated desktop `llms.txt` link satisfies the every-link-annotated convention) | Devin |
| 2026-10-10 | `renderLlmsTxt` deploy list += `scripts/setup.mjs` guided-setup link, manifest-gated like `setup-env.mjs` (web only) | Devin |
| 2026-10-06 | +`INTERNAL_PROVENANCE_LINE` — a stricter second banned-line pass applied only inside `renderAiMirror` (private maintainer orgs/products, agent/branch provenance, sync-pipeline identifiers, sibling-checkout words, unshipped commands); `renderLlmsTxt` wording fixes: doctor bullet says audits-and-repairs, web `.env.example` note names `apps/web/.env.local`, deploy heading becomes `Deploy the backend` when `docs/agent-setup.md` is absent | Devin |
| 2026-10-06 | `renderLlmsTxt` gates: `supabase:doctor` Security mention only where `scripts/supabase-doctor.mjs` ships (web), `.devin/wiki.json` Optional link only when it lands in `files` (GENERATED membership alone is not evidence — mirror() writes it conditionally); `KEEP_SCRIPTS` += `check:local`/`typecheck:local` | Devin |
| 2026-10-06 | +`renderLlmsTxt(spec, files)` and `llms.txt` in `GENERATED`; `renderReadme` points agents at it; `subrepos.json` extraPaths gained curated `docs/*.md` guides, the web `prompts/` shelf, and `docker-compose.dev.yml` | Devin |
| 2026-10-06 | `renderLlmsTxt` += `promptNotes` map — shipped prompt links now carry `: note` annotations like guides (`guideNotes`) | Devin |
| 2026-10-07 | Linked shared security guidance with explicit auth/BFF, PostgREST RLS and redacted-log rules; native exports qualify backend setup as web-checkout content | Codex |
| 2026-10-07 | Generated security protocols retain `openssl rand` secret-generation guidance and accurately distinguish static log messages from redacted structured context | Codex |
| 2026-10-07 | The setup section links the manifest-gated web-only `scripts/setup-env.mjs` helper | Codex |
| 2026-10-03 | `LICENSE.md` added to `ROOT_FILES`; `renderRootPackageJson` emits `license: "SEE LICENSE IN LICENSE.md"`; `renderReadme` gains a License section | Devin |
| 2026-09-27 | +`ignoredPaths` (moved from the CLI, `{warn}` option) + `applyShippedIgnoreRules` — the second ignore pass pre-writes every shipped `.gitignore` into `work` so `check-ignore` evaluates the incoming rules, not the checkout's stale revision (a stale `.ai/` rule had dropped all mirror docs) | Devin |
| 2026-09-27 | `runGit`/`git`/`gitOrThrow`/`listGit`/`GIT_ENV` lifted from sync-subrepos.mjs into exports; +`captureCheckoutState`/`positionBranch`/`restoreCheckoutState` — local commits preserved via rebase onto the remote tip, checkout state restored on rebase failure and for `--dry-run` | Devin |
| 2026-09-27 | +`GENERATED`/`pruneEmptyDirs` lifted from the CLI; +`restoreDryRunSibling` so the sibling dry-run restore runs on every dry-run exit (the "up to date" early return had skipped it); rebase-failure unwind gained `--abort`→`--quit` fallback | Devin |
| 2026-09-26 | `.ai` mirrors ship with shipped files + `renderAiMirror` internal-only-line scrub (husks skipped); `renderAgentsMd` now keeps `.ai/` rule via shared `INTERNAL_ONLY_LINE`; README "What's inside" gained `.ai/` | Devin |
| 2026-09-22 | +`renderWikiJson` + `WIKI_PAGE_SHIP` — per-repo `.devin/wiki.json` filtered to shipped code, parents reparented | Devin |
| 2026-09-20 | Created for the Tauri/subrepos spec (Part 2) | Devin |
| 2026-09-20 | `.gitattributes` added to `ROOT_FILES` so sub-repo clones also pin LF (issue #1) | Devin |
| 2026-09-21 | `renderReadme` emits bilingual EN + `## 简体中文` READMEs (repos moved to a dedicated GitHub org) | Devin |
| 2026-09-22 | `renderReadme` back to English-only; sibling READMEs regenerated in place (sync push pending) | Devin |
