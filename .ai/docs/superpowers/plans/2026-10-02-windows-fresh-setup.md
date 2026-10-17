# Windows fresh setup verification

## Purpose

Track the bounded repair and acceptance evidence for the Windows installation,
build and browser-test workflow in this repository.

## Open Threads / Resume Context

- Reproduce the writable Turbo cache shutdown stall in an isolated clean checkout.
- Add regression coverage before changing build/cache defaults or generated types.
- The isolated Windows gate passed: 1,709 tests, 34 gated skips, 18 uncached
  builds, 25 local E2E and 15 production E2E tests before the larger-main integration.
- The expanded 665-path sitemap then exhausted Next dev memory during warm-up.
  Three regression tests were red before sharing documentation-module warm-up;
  82 focused tests passed after the repair on remote main `19bc374`.
- Final combined Windows gate exited 0 on 2026-10-03: 1,831 tests, 34 gated
  skips, 18 cold typechecks, 18 uncached builds, 34 local and 15 production E2E
  cases. Build exited normally and browser setup did not restart for memory.
  The exact receipt is committed before the authorized main push; verify remote
  SHA after publication. Hosted Windows CI remains a separate run.
- The two September 28 friction attachments are absent at their supplied paths;
  do not claim their contents were reviewed.

## Important Notes

- Preserve the desktop-free local gate, fake/local providers, real navigation
  assertions and explicit user cache/browser overrides.
- Keep the original checkout's unrelated changes intact.
