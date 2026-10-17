# apps/desktop/src-tauri/Cargo.toml

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Crate manifest for the Tauri shell (`supastack-desktop`). `lib` crate-type is
`staticlib`/`cdylib`/`rlib` so the same code backs the desktop binary and
mobile entry points.

## What It Does

- `tauri = "2"` with `tray-icon` feature; `tauri-build = "2"` build dep.
- Plugins: `autostart`, `deep-link`, `dialog`, `global-shortcut`, `opener`,
  `process`, `single-instance` (with the `deep-link` feature), `updater`,
  `window-state`.
- The single-instance plugin's `deep-link` feature forwards Windows/Linux
  second-instance scheme URLs through the app callback.
- `serde`/`serde_json` — required by `tauri::generate_context!` (config
  deserialization), not just runtime code.
- `url` — shared by URL resolution and the `on_navigation` host check.
- `custom-protocol` feature maps to `tauri/custom-protocol`.

## Important Notes / NEVER Change

- Linux builds need system packages (pkg-config, glib-2.0, gtk-3,
  libsoup-3.0, webkit2gtk-4.1, javascriptcoregtk-4.1, libxdo, openssl,
  ayatana-appindicator3, rsvg2) before `cargo check`/`tauri build` works.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Added deep-link/opener/window-state plugins + serde/serde_json | Devin |
| 2026-10-01 | Enabled single-instance deep-link forwarding | Codex |
| 2026-10-12 | Added updater/process/dialog/autostart plugin deps for the update path + launch-at-login | Devin |
| 2026-10-12 | `rust-version` bumped to 1.90 — tauri 2.12.x + plugin deps declare it as their MSRV | Devin |
