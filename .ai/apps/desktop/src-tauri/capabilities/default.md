# apps/desktop/src-tauri/capabilities/default.json

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Tauri capability set applied to every window (`windows: ["*"]`).

## What It Does

- `core:default` — baseline window/event permissions.
- `opener:allow-open-url` — required so `app.opener().open_url` calls
  (external-link interception in lib.rs) are permitted.

## Important Notes / NEVER Change

- Keep permissions minimal — tray/menu/hotkey run Rust-side and need no JS
  grants; deep links are read and validated by Rust, not by the hosted webview.
  Don't add product-UI permissions here (shell has no product UI).
- Pure JSON, no comments (prettier formats it).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Added deep-link + opener permissions alongside core:default | Devin |
| 2026-10-01 | Removed the unused JavaScript deep-link grant; Rust owns URL handling | Codex |
