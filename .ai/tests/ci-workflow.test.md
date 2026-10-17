# tests/ci-workflow.test.ts

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Structural coverage for `.github/workflows/ci.yml` so the desktop CI gate
cannot silently lose lanes or steps.

## What It Does

- Parses the workflow by line scan (jobs are the two-space-indented keys
  under `jobs:`); no YAML dependency is added for this.
- Asserts the `desktop` job exists, runs on a `fail-fast: false` matrix of
  `ubuntu-latest` + `windows-latest` + `macos-latest`, and allows 45
  minutes.
- Asserts the pinned toolchain (checkout@v4, pnpm/action-setup@v4
  11.19.0, setup-node@v4 22.20.0 with pnpm cache, `--frozen-lockfile`
  install) precedes the scripts.
- Asserts each lane runs `pnpm --filter @supastack/desktop test` (Rust
  tests + boot.js syntax check) and `pnpm --filter @supastack/desktop
  build` (a real per-webview-engine installer build).
- Asserts the Linux-only apt step (`runner.os == 'Linux'`) installs the
  Tauri deps plus FUSE, with the `libfuse2` → `libfuse2t64` fallback for
  Ubuntu 24.04.
- Asserts the build step sets `NO_STRIP: "true"` (linuxdeploy `strip` /
  `.relr.dyn` workaround on ubuntu-24.04).
- Asserts `Swatinem/rust-cache@v2` is keyed by `matrix.os`.
- Pins that `validate` still installs the Tauri Linux deps and runs
  `pnpm check` (belt-and-suspenders `cargo check` coverage).

## Important Notes / NEVER Change

- `yaml`/`js-yaml` exist only as transitive deps; keep the line-scan
  approach rather than importing an undeclared package.
- The test scans the checked-in file directly — it verifies workflow
  structure, not runner behavior.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-02 | New structural test pinning the three-OS desktop matrix, test+build script invocations, FUSE fallback, per-OS cargo cache, and the unchanged `validate` cargo-check coverage | Devin |
