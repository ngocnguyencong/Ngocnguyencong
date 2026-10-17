# Windows Fresh Setup Implementation Plan

**Goal:** Make the documented Windows build and complete local E2E acceptance
workflow finish from a clean checkout, then commit and push the scoped fix to main.

**Architecture:** Preserve Turbo's task graph and Playwright's actual assertions.
Use a dependency-free Node launcher for the previously demonstrated Windows
read-only Turbo cache mitigation, preserving explicit cache overrides. Generate
Next's environment and route types before standalone typechecking instead of
committing files that Next rewrites. Retain browser warm-up and owned test servers.

**Tech stack:** Node 22, Corepack/pnpm, Turbo 2.10.12, Next 16.3.6, Vitest,
Playwright Chromium, Windows PowerShell.

## Checklist

- [x] Inspect repository memory, existing fixes, scripts and remote main; isolate
      this repair from unrelated local work and install with the frozen lockfile.
- [x] Reproduce the full default writable-cache build; record exit or shutdown
      stall. Run `corepack pnpm exec vitest run tests/e2e/local-setup.test.ts
tests/playwright-config.test.ts` as baseline.
- [x] Add failing guards in `tests/e2e/local-setup.test.ts` for untracked generated
      Next files and cold type generation; add `tests/turbo-runner.test.ts` for Windows
      cache defaults, user overrides, other platforms and child exit propagation.
- [x] Add `scripts/run-turbo.mjs`; wire the root build and shipped Web build to
      `node scripts/run-turbo.mjs run build`, including the helper in the Web manifest.
      Remove tracked `apps/{web,docs}/next-env.d.ts`, set each app's typecheck to
      `next typegen && tsc -p tsconfig.json --noEmit`, and include the generated Web
      types in its tsconfig. Maintain matching mirror docs before implementation.
- [x] Audit browser availability and cache reuse; add only fixes supported by
      reproduced failures. Preserve Windows four-worker concurrency and time budgets.
- [x] Run `corepack pnpm verify:local` end to end with no cache override and a
      fresh Next cache. Run meaningful focused regression and sub-repo tests. Add a
      Windows CI job using the documented shim and the complete local gate.
- [x] Fix the observed jsdom worker startup failure by capping Windows Vitest
      workers at four. The worker-policy regression was red before the config
      change; all 13 OTP tests and the 36-test focused suite then passed.
- [x] Verify the bounded sitemap warm-up and current mobile navigation with the
      entire local gate on remote main `19bc374`, using copied example config
      and cold Next/Turbo caches. The focused navigation case passed after repair.
- [x] Record exact results, review the scoped diff and prepare the authorized main
      update without bundling the original checkout's pending work.

## Final verification (2026-10-03)

On remote main `19bc374` plus this repair, `corepack pnpm verify:local` exited 0
on Windows using the README example configuration, cold Next caches, a fresh
Turbo cache directory, no `TURBO_CACHE` or browser-channel override, and the
4 GB Node heap budget used by CI:

- Lint and formatting passed.
- 18/18 typechecks, 0 Turbo cache hits, completed in 51.291 seconds.
- 1,831 tests passed; 34 intentionally gated tests skipped (237 passing files,
  10 gated files). No unhandled test errors.
- 18/18 builds, 0 Turbo cache hits, completed in 1m55.094s and exited normally.
- 34/34 local browser cases passed in 2.8 minutes, including the revised mobile
  navigation and all nine beginner-documentation cases.
- Cache reset and 15/15 production-interface cases passed in 1.2 minutes.
- No Next memory-threshold restart occurred in the successful browser run.

This receipt is committed before the authorized main push. Verify the remote
main SHA after pushing; hosted Windows CI is a separate run of the same workflow.

## Evidence limits

The repaired isolated checkout completed `corepack pnpm verify:local` with exit
0: lint, 18 typechecks, 1,709 tests (34 intentionally gated skips), formatting,
18 uncached builds, 25 local browser tests and 15 production-interface browser
tests. The build used the default Windows cache policy and exited normally.
Integrate the newer main commits and verify that combined tree before pushing.

On integration, copying the documented `.env.example` exposed invalid blank
`CREEM_TEST_MODE`, `SMTP_SECURE` and `MAILGUN_REGION` options. The existing local
config regression and fix commits were applied independently of unrelated branch
changes: 3 tests failed before the fix, then all 113 focused setup/config/cache/
browser/sub-repo tests passed. The Windows CI job also copies the example files.

The first combined-tree gate stopped at 12 `no-undef` lint errors in the newly
added desktop release-check script. Explicit Node console/process/URL imports
repair that gate without changing the script's validation behavior.
The combined tree also needed Prettier normalization of that script and its
existing release-config test; their validation assertions remain unchanged.

Fresh-browser verification used an empty `PLAYWRIGHT_BROWSERS_PATH`: the pinned
Chromium, headless shell and Windows dependencies downloaded successfully, and a
headless page launch returned Chromium 151.0.7922.34. The local machine uses Node
22.16.0, Corepack 0.32.0 and pinned pnpm 11.19.0; hosted CI uses Node 22.20.0.
That browser fixture initially lived under the worktree and was picked up by
ESLint, causing a separate failed integration attempt. It was moved to the
user's local application cache before the final gate; lint exclusions were not
changed to accommodate the fixture.
The integrated public sitemap contains 665 paths. Warming every URL exhausted
Next dev memory: it restarted twice, then navigation to
`/de/docs/components/site-footer` timed out at 120 seconds. That attempt passed
lint, 18 cold typechecks, 1,819 tests (34 gated skips), formatting and 18 uncached
builds, but did not pass E2E. Preserve this failed attempt as evidence.

Three warm-up-selection regressions failed before implementation. Sitemap
warm-up now shares one representative per documentation catch-all/locale,
skips modules already warmed explicitly and keeps every distinct static or
unknown route. Browser assertions, worker counts and timeouts are unchanged.
The latest remote main (`19bc374`) was integrated with its desktop CI job intact;
equivalent config and lint fixes already upstream were retained. Run the whole
local gate again against this combined tree before pushing.

The bounded cold-cache browser run then reached assertions normally: 33/34
passed in 3.3 minutes with no memory-threshold restart. The remaining test used
the removed mobile-footer label "Continue setup" and the old page title. Update
it to the current "Next Set up Expo in 5 minutes" adjacent link, adding exact
href and destination-URL assertions while retaining search and empty-state checks.

The initial writable-cache build reported 18/18 successful tasks in 4m17s, then
failed to exit after its summary. The first complete local gate passed lint and
18 typechecks but failed with one unhandled jsdom worker startup timeout, despite
1,695 runnable tests passing. These failed attempts are retained as failure
evidence; they are not complete acceptance results.

The supplied friction-report and log-excerpt paths are absent. No instruction in
those attachments has been acted on, and no claim of attachment review is made.
This task verifies repository-recorded issues and the actual clean-checkout run.
