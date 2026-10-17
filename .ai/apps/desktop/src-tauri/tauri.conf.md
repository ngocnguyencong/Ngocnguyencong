# apps/desktop/src-tauri/tauri.conf.json

## Purpose

Tauri 2 config. frontendDist is ../ui, windows are created in Rust, supastack deep-link scheme is registered, and OS bundles use blank placeholder-icons. Keep pure JSON and the Rust-owned window/auth/navigation boundary. Native package identifiers and icon assets are product customization points.

## Important Notes / NEVER Change

- `plugins.updater` ships as an empty sentinel (`"endpoints": [], "pubkey": ""`) and MUST stay present: the updater plugin's config deserialization requires `pubkey`, and a missing/invalid `plugins.updater` aborts plugin init — the app would not start. `check-release-config.mjs` (`JSON.parse`) also reads this file, so it must remain strict JSON (no comments). Real endpoint/pubkey values enter only via the `tauri build --config`/`TAURI_CONFIG` overlay documented in docs/desktop-updates.md — never commit key material or endpoints here.

## Change History

- 2026-10-04: default logo artwork removed; demo content stays neutral.
- 2026-10-12: added empty `plugins.updater` sentinel required by the registered updater plugin.
