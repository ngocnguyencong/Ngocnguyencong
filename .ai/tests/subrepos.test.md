# tests/subrepos.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Vitest coverage for `scripts/subrepos.mjs` against fixture workspaces in
`fs.mkdtemp` tmpdirs — package map, `workspace:*` closure (incl. devDeps),
`deriveRemote` (https/ssh/invalid), `resolveWorkDir` (managed `.subrepos` vs
`checkout`/`SUBREPO_HOME` sibling modes), `resolveRemote` (env → sibling origin
→ derived precedence), `renderRootPackageJson` (toolchain keep-list, script
overrides, test-script drop when no `*.test.*` files), buyer-facing renders
(`renderAgentsMd` drops sync/internal-only lines but keeps the `.ai/` memory rule,
`renderAiMirror` scrubs internal-only + provenance lines, collapses blanks, returns
null for husk docs, `renderEnvExample` strips `SUBREPO_*`, `renderReadme` fork-friendly
+ English-only `\p{Script=Han}` guard + `.ai/` + `LICENSE.md` pointer),
`renderRootPackageJson` carries `license: "SEE LICENSE IN LICENSE.md"`,
`buildFileManifest`
(exclusions + `.gitattributes` + `LICENSE.md` in `ROOT_FILES` + `.ai` mirrors: shipped-file
mirrors incl. `package.json`→`package.md` / `.env.example`→`.env.example.md` /
`.gitattributes`→`gitattributes.md`, `.ai/PROJECT_CONTEXT.md` always shipped,
`.ai/README.md` + mirrors of unshipped files never ship), `renderWikiJson`
(DeepWiki shape, unique titles, resolvable parents, per-repo scoping to the
shipped manifest, buyer-clean banned-term check), `renderLlmsTxt` (repo-name
H1 + per-app flavor, every link gated on the shipped manifest or GENERATED,
`.devin/wiki.json` link only when it lands in `files` — the conditional
GENERATED member, `supabase:doctor` Security mention only where its script
ships, always-on Security protocols, prompts/deploy sections emitted only
when their files ship, no Guides double-listing), and the git-positioning
block (`positionBranch`/`restoreCheckoutState`/`restoreDryRunSibling`) run
against real temp git repos: local commits replayed onto the remote tip,
rebase-conflict abort + ref/HEAD restore, `origin/<branch>` absent,
ancestor fast-forward, checkout-state restore for a moved branch, a
detached HEAD, and an unborn fresh checkout, plus the no-change dry-run
unwind (refs/tracked/index identical; foreign untracked files survive),
and `applyShippedIgnoreRules` against `git init` checkouts (shipped
`.gitignore` pre-written so a stale `.ai/` rule no longer drops mirror
docs; nested `.gitignore` pre-written too; the checkout's own rules remain
the fallback when the manifest ships none), plus the shipped-text
consistency describe over the real manifests: every `pnpm <name>` in
code spans of shipped docs/prompts + generated `llms.txt`/`README.md` +
rendered `AGENTS.md`/`.env.example` exists in that repo's generated
`scripts` (pnpm builtins/bin passthroughs exempt; `--filter` invocations
are package-scoped and skipped; `KNOWN_UNSHIPPED_COMMANDS` is an
exact-match doc-debt list; native docs skip same-line commands explicitly
qualified for the `supastack-web` checkout before code-span extraction, while
the web flavor still checks them normally), every `scripts/*.mjs` path ships, every
relative `](path)` link in shipped `docs/`/`prompts/` resolves into that
flavor's manifest (∪ GENERATED; leading-slash targets are product routes,
skipped), `--filter @supastack/(web|db)` and
`pnpm (verify:*|test:e2e*|smoke:providers|supabase:*)` invocations sit only
on lines naming `supastack-web`/`web checkout`/`web repo` else they join the
bidirectional `KNOWN_UNSHIPPED_REFERENCES` debt list, shipped `.ai` mirrors
render Han-free except the `KNOWN_HAN_MIRRORS` translation debt list and
provenance-token-free outright, and every `docs/`/`prompts/` link in the
generated `llms.txt` carries a `: note` annotation.
Also includes a real-manifest regression that ships the AWS SES walkthrough
and its mirror to every platform; the Windows conflict-restore matrix covers
LF and CRLF. The prod-ready-kit merge added
`jobs:tick`/scheduler-tick manifest coverage (extraPath shipped to all three
repos); the `.ai`-shipping change added the mirror/husk/scrub cases; the
2026-09-27 positioning fix added the real-git describe (uses the exported
`runGit`/`git`/`gitOrThrow`/`listGit`); the same day's ignore-ordering fix
added the `applyShippedIgnoreRules` describe.

## Important Notes

- Real workspace manifests and read-only shipped text are cached once per
  flavor for this test file; temp-root fixture tests always build from their
  isolated trees. The full real-manifest scan keeps a bounded 60-second
  timeout for slower Windows runners.
- Windows beta repair (2026-10-05): fixture repos and scratch clones pin
  `core.autocrlf=false` and `core.eol=lf` locally. The conflict-restore case
  explicitly covers both `autocrlf=false` (LF) and `autocrlf=true` (CRLF),
  retaining restored-ref, clean-index, and exact-content assertions. The old
  assertion failed under an isolated global `autocrlf=true`/`eol=crlf` config;
  all 48 cases pass after the repair. Never change user Git configuration or
  run real sync targets for this test.

- Security repair: assert referenced public dependency patch files ship with platform manifests. Keep the fixtures local; no actual target synchronization or pushes.
- Security map coverage pins the shared checklist in all three real platform
  manifests, explicit Better Auth/Auth.js + BFF and PostgREST exposure/RLS/logging
  guidance, and a plain-text `supastack-web` qualifier for native backend setup
  without dangling links.
- Shipped-command consistency treats same-line `supastack-web checkout`
  qualifiers as context only for native flavors and removes those full lines
  before code-span extraction; the web flavor still validates each command.
- The environment-bootstrap map check pins `scripts/setup-env.mjs` to the web
  manifest and generated web setup section; mobile and desktop must not ship it.
  A sibling pin does the same for the `scripts/setup.mjs` guided wizard — file,
  `.ai` mirror, and the `[Guided setup wizard]` llms entry appear only in the
  web flavor.
- Real-manifest scan optimization: prewarm and reuse each platform's actual
  manifest plus read-only source text across consistency checks. Keep fixture
  tests on their independent temp roots so mutation coverage is not cached.

- Fixture roots are real temp dirs; `afterEach` removes them. The git
  fixtures live entirely under `os.tmpdir()` — never the checkout paths
  named in `scripts/subrepos.json` (`git init -b main` pins the default
  branch so host `init.defaultBranch` cannot skew them); remotes are bare
  repos wired via `remote add origin <path>` + `fetch`, advanced through a
  scratch clone.
- `siblingGuard` stays in the CLI (not exported) so it is not covered
  here — but its ordering before `captureCheckoutState`/`positionBranch`
  is load-bearing (it reads the pre-positioning porcelain/foreign-commit
  state); see the mirror doc note.
- Fixture repos get repo-local `user.name`/`user.email` config — the
  internal `git rebase` in `positionBranch` reads ambient committer
  identity, which a `useConfigOnly` runner may not provide. The
  `applyShippedIgnoreRules` fixtures pin `core.excludesFile` to an empty
  path instead, so a host-level global ignore cannot skew check-ignore.
- `ignoredPaths` moved to `subrepos.mjs` for the ignore-pass fix — the
  `applyShippedIgnoreRules` describe pins the stale-`.gitignore`
  regression directly (`.ai/` mirror docs survive, newly-ignored paths
  still drop, nested `.gitignore` files ship too).
- Coverage choice (per review): the CLI's two dry-run exits ("up to date"
  and "would commit") cannot be exercised without running `syncRepo`,
  which is not importable (executes on load) and must never run — the
  sibling checkouts in `subrepos.json` are real. Instead the shared
  `restoreDryRunSibling` helper is the tested seam: one helper called from
  both exits, with its refs+tree+index+untracked invariant pinned here.
- `tests/**/*.ts` is in eslint's `disableTypeChecked` list — no tsconfig needed.
- The package render cases use current Corepack script composition and read
  the real root manifest plus desktop file closure; this catches drift between
  the synthetic fixture and the generated buyer package. A test-bearing
  manifest must retain its test script and check step.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | +web-only pin for `scripts/setup.mjs`: file, `.ai/scripts/setup.mjs.md` mirror, and `[Guided setup wizard]` llms link asserted web-only across all platform manifests | Devin |
| 2026-10-07 | Cache unchanged per-flavor real manifests and source text across shipped-text checks; keep the full scan bounded to 60 seconds | Codex |
| 2026-10-07 | Added shared-checklist gating, native backend-setup qualifier, explicit security boundary assertions, and all-flavor manifest coverage | Codex |
| 2026-10-07 | Command guard filters explicitly `supastack-web checkout`-qualified lines before code extraction for native flavors; restores generated `openssl rand` secret guidance | Codex |
| 2026-10-07 | Added manifest/render assertions for the web-only safe environment bootstrap helper | Codex |
| 2026-10-07 | Removed the resolved web setup prompt's `--filter @supastack/db` debt expectation; the strict shipped-command guard remains active | Codex |
| 2026-10-06 | +3 shipped-text guards: relative `](path)` links resolve into each flavor's manifest (∪ GENERATED), repo-qualified monorepo-command references gated by bidirectional `KNOWN_UNSHIPPED_REFERENCES` debt list, rendered `.ai` mirrors carry zero internal provenance tokens; `KNOWN_HAN_MIRRORS` lost `.ai/apps/web/app/contact/page.md` (the provenance pass removed its last Han line — staleness check caught it) | Devin |
| 2026-10-06 | +shipped-text consistency describe (4 tests over the real manifests: `pnpm <name>` ↔ generated `scripts` with `KNOWN_UNSHIPPED_COMMANDS` doc-debt list, `scripts/*.mjs` ↔ manifest, Han-free `.ai` mirrors modulo `KNOWN_HAN_MIRRORS` translation debt, llms.txt link annotations); `renderLlmsTxt` describe += wiki-link and doctor-mention gate cases | Devin |
| 2026-10-06 | +`renderLlmsTxt` describe (5 tests: H1/flavor, manifest-gated links incl. GENERATED siblings, always-on Security protocols, prompts/deploy sections conditional on shipped files); imports gained `GENERATED` + `renderLlmsTxt` | Devin |
| 2026-10-03 | +2 real-repo tests: every workspace manifest declares `license`; `LICENSE.md` + `.ai/LICENSE.md` (case-pinned) in the web manifest, unignored | Devin |
| 2026-10-03 | License pins: `LICENSE.md` in the fixture + real desktop manifest, `rendered.license` assertion, `renderReadme` LICENSE.md pointer | Devin |
| 2026-09-28 | Updated package fixture for Corepack and pinned actual desktop no-tests render plus test-bearing preservation | Codex |
| 2026-09-27 | +`applyShippedIgnoreRules` describe: stale-checkout `.gitignore` regression (`.ai/` mirrors survive the second ignore pass), nested `.gitignore` pre-write, no-shipped-`.gitignore` fallback; `core.excludesFile` pinned empty per fixture | Devin |
| 2026-09-27 | Real-git describe timeout raised to 30s — default 5s flakes under full-suite parallel load (git subprocess latency) | Devin |
| 2026-09-27 | +`restoreDryRunSibling` no-change dry-run case (refs/tracked/index byte-identical, foreign untracked survives); fixture repos now configure local `user.name`/`user.email` so the internal rebase works under `useConfigOnly` | Devin |
| 2026-09-27 | New real-git describe: unpushed local commits preserved via rebase onto remote tip, conflict → false + refs restored (no REBASE_HEAD, clean status), missing remote branch, ancestor fast-forward, `restoreCheckoutState` for attached/detached/unborn states; imports extended to the lifted git exports | Devin |

Release sync regression: LF and CRLF rendering of the three filtered text surfaces must be identical, including blank runs around removed internal lines. All three cases reproduced the failure before normalization and passed after it.
