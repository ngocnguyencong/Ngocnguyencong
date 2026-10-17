# tests/desktop-release-config.test.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

2026-10-03: Normalize existing test formatting with the repository's Prettier version before publishing. Assertions and release validation coverage are unchanged.

Regression coverage for the desktop release preflight rules, including the
optional updater endpoint/pubkey pair.

## What It Does

- Accepts a public credential-free HTTPS endpoint with a product-specific Tauri identifier.
- Rejects HTTP, credentials, localhost/private/shared/reserved IP hosts, malformed DNS names, malformed identifiers, and the starter bundle identifier.
- Verifies credential values are not included in validation errors.
- Confirms the CLI check reads the identifier from the real Tauri config.
- Updater rules: endpoint+pubkey required as a pair; endpoint must be
  credential-free HTTPS on a public host (localhost/`.internal`/private
  IPs rejected) containing `{{current_version}}`; missing
  `{{target}}`/`{{arch}}` yields warnings (not errors); non-base64/short
  pubkeys are rejected; `buildUpdaterConfigOverlay` emits the
  `plugins.updater` overlay JSON.
- `checkDesktopReleaseConfiguration` call sites pass `""` for unset
  updater vars so a developer's exported `SUPASTACK_UPDATER_*` env cannot
  flake the assertions.

## Important Notes / NEVER Change

- These tests cover local validation only; they do not resolve DNS or test
  installer signing.
- The result shape is `{ valid, errors, warnings }` — the first test asserts
  exact equality, so keep it in sync when the shape changes.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Added regression coverage for desktop release URL and identifier preflight | Codex |
| 2026-10-12 | Updater pair validation, token warnings, pubkey shape, overlay emission, env plumbing; `warnings` added to the asserted result shape | Devin |
