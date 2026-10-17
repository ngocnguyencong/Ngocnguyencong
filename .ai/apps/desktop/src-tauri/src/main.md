# apps/desktop/src-tauri/src/main.rs (+ build.rs, Cargo.toml, capabilities/, ui/)

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Boilerplate ring around `lib.rs`: `main.rs` calls `supastack_desktop_lib::run()`
(release builds hide the console via `windows_subsystem`); `build.rs` runs
`tauri_build::build()`; `Cargo.toml` declares tauri 2 + global-shortcut +
single-instance + `url` (URL validation in lib.rs); `capabilities/default.json`
grants `core:default`; `ui/index.html` is the bundled boot page
(`frontendDist`).

## Important Notes / NEVER Change

- `Cargo.lock` is committed (app crate → reproducible builds). `target/` and
  `gen/` are gitignored via `src-tauri/.gitignore`.
- `[lib] crate-type = staticlib/cdylib/rlib` is required by Tauri — don't trim.
- Keep `ui/` minimal — the boot page shows only while it probes and redirects
  to the remote app URL.
