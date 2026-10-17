# .github/workflows/ci.yml

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Main CI gate on `push` to `main` + PRs: `validate` (install → `pnpm test`
→ postgres-gated integration specs → `pnpm check` → `pnpm build` →
Playwright chromium + production acceptance), `desktop` (three-OS matrix
running the desktop Rust tests plus a real `tauri build` installer pass
per webview engine), `dependency-license-review`
(PRs only, installed-license report checked by a tested local script), and
`security-scan` (`pnpm audit --audit-level=high` + checksum-verified Gitleaks
CLI over repository history). Historical fixture and documentation false
positives are pinned by fingerprint in `.gitleaksignore`.

## Important Notes / NEVER Change

- Credential-free validation explicitly selects `APP_ENV=test`, including
  production compilation. This does not configure deployed servers.

- Windows fresh-setup coverage runs the whole credential-free `verify:local`
  chain after frozen installation, a user-writable Corepack shim and copying
  `.env.example` to `.env` and `apps/web/.env.local` as the README instructs. It uses no
  Rust toolchain or provider credentials. Browser failures upload test traces.
  The Node heap budget is 4 GB, matching the existing Linux lint budget.
  Its 60-minute budget includes cold builds and real-browser warm-up of every
  sitemap page module; every existing navigation scenario remains.

- `pnpm check` runs `turbo run typecheck` across ALL workspaces — that
  includes `@supastack/desktop`'s `cargo check`, which needs Tauri's
  Linux system libs on the Ubuntu runner. The "Install Tauri Linux
  system dependencies" step (apt: glib/gtk-3/webkit2gtk-4.1/soup-3.0/
  javascriptcoregtk-4.1/ayatana-appindicator3/rsvg/xdo/ssl/pkg-config)
  must stay ahead of `pnpm check`; removing it reintroduces the
  `glib-sys` pkg-config failure from 2026-09-22.
- `pnpm check` sets a 4 GB Node heap on the Ubuntu runner because the
  repository-wide ESLint pass exceeds Node's default 2 GB heap there.
- `validate` allows 35 minutes for the full checks, build, Chromium suite,
  and offline production browser suite; 20 minutes was too short for all
  stages on the hosted runner.
- `node scripts/reset-e2e-cache.mjs` runs between the two e2e suites: both
  spawn `next dev` on the same dir, and the second server crashed resuming
  the first server's + `pnpm build` graph state (Turbopack
  `inner_of_upper_lost_follower` panic). A clean cache is worth the ~1min
  of recompiles; the suites' warm-up globalSetups cover the cold-start.
- The audit gate fails on high/critical advisories; transitive fixes go
  through `overrides` in `pnpm-workspace.yaml`, not by ignoring the job.
- 2026-10-03: Verify the three unreleased dependency backports with frozen
  installation and their runtime regressions, then check the registry report
  against exact patch hashes and versions. Warnings remain visible; new or
  unverified advisories fail. The checker must not become a general ignore list.
- The repository cannot use GitHub's dependency-review action without its
  dependency-graph security service, and the Gitleaks action requires an
  organization license. Local license and secret scans keep those gates
  operational without service configuration or a license secret.
- The secret scan omits pnpm cache setup because it does not install
  dependencies; setup-node cache cleanup otherwise fails after a successful
  Gitleaks scan.
- `.github/` does NOT ship to sub-repos (not in `ROOT_FILES`) —
  monorepo-side pipeline only.
- `desktop` runs `cargo test` + `tauri build` on each OS because webview
  behavior differs per engine (WebKitGTK/Edge WebView2/WebKit) — the
  installer build itself is the verification, so it must not degrade to
  `cargo check` or a debug compile. `fail-fast: false` keeps each OS
  reporting independently, and `Swatinem/rust-cache` is keyed by
  `matrix.os` so lanes never share caches.
- The Linux lane's apt step duplicates `validate`'s Tauri list on purpose
  and adds FUSE (`libfuse2` with a `libfuse2t64` fallback — Ubuntu 24.04
  renamed the package) because AppImage bundling fails without it.
- `desktop` gets 45 minutes: a release `tauri build` compiles the whole
  Rust tree plus bundling on a cold cache.
- The build step sets `NO_STRIP: "true"`: linuxdeploy's bundled `strip`
  fails on `.relr.dyn` sections of ubuntu-24.04's newer glibc, which would
  otherwise break the AppImage target. The variable is unused on
  macOS/Windows.
- Structure is pinned by `tests/ci-workflow.test.ts` (line-scan; no YAML
  dependency may be added to the repo for it).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-02 | New `desktop` matrix job (ubuntu/windows/macos, fail-fast false, 45min): Rust tests + real `tauri build` per webview engine, per-OS cargo cache, Linux Tauri deps + FUSE fallback for AppImage | Devin |
| 2026-09-27 | Allow the complete browser validation run to finish on hosted runners | Codex |
| 2026-09-28 | Wipe `apps/web/.next` between the two e2e suites — second `next dev` panicked on the shared Turbopack graph | Devin |
| 2026-09-27 | Remove unused security-job dependency cache after successful Gitleaks scan failed at cache cleanup | Codex |
| 2026-09-27 | Replace unavailable hosted dependency/Gitleaks actions with local license checker and pinned Gitleaks CLI; raise validation heap for repository lint | Codex |
| 2026-09-22 | Install Tauri Linux system deps before `pnpm check` so the desktop `cargo check` typecheck works on Ubuntu runners | Devin |
