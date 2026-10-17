# apps/desktop/scripts/check-release-config.mjs

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Explicit preflight for desktop installer readiness. It reads the bundle
identifier from the actual Tauri config, checks the release backend URL, and
validates the optional updater pair (`SUPASTACK_UPDATER_ENDPOINT` +
`SUPASTACK_UPDATER_PUBKEY`), printing the `plugins.updater` config overlay
when both are present.

## What It Does

- Requires `SUPASTACK_APP_URL` to be a credential-free HTTPS URL on a public
  host rather than localhost, private, shared, reserved, malformed, or
  single-label addresses.
- Requires a valid reverse-domain bundle identifier and rejects the starter
  default `com.supastack.desktop` so a product release has its own identity.
- Updater checks (optional, both-or-neither): endpoint must be a
  credential-free HTTPS URL on a public host (same
  `isLocalOrReservedHost` classification as `SUPASTACK_APP_URL`) containing
  `{{current_version}}`; missing `{{target}}`/`{{arch}}` is a non-fatal
  `warnings` entry (documented static endpoint shape); the pubkey must
  look like a base64 minisign key (≥40 chars, base64 charset). An optional
  `{{channel}}` placeholder is accepted anywhere in the endpoint (the
  shell substitutes `stable`/`beta` per install at runtime) — the host
  rule still applies to the literal hostname, so a placeholder in the
  hostname is rejected like any other non-public host.
- Prints actionable errors without echoing the full URL or any credentials;
  warnings go to `console.warn` before the verdict.
- `main()` prints the `{"plugins":{"updater":{"endpoints":[…],"pubkey":"…"}}}`
  overlay for `tauri build --config` when configured, and notes the updater
  is disabled otherwise. `buildUpdaterConfigOverlay` trims both values so
  padded env vars cannot ship whitespace into the config.
- Is an explicit preflight only; regular development and build scripts do not
  run it automatically.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `validateReleaseConfiguration` | function | Validates the provided URL, Tauri identifier, and optional updater endpoint/pubkey, returning `{ valid, errors, warnings }`. |
| `checkDesktopReleaseConfiguration` | function | Loads the real `src-tauri/tauri.conf.json`, validates it with `SUPASTACK_APP_URL` (+ optional `SUPASTACK_UPDATER_ENDPOINT`/`SUPASTACK_UPDATER_PUBKEY`), and returns `{ valid, errors, warnings }`. |
| `buildUpdaterConfigOverlay` | function | Emits the `{"plugins":{"updater":{"endpoints":[…],"pubkey":"…"}}}` JSON overlay for `tauri build --config`/`TAURI_CONFIG`. |

## Dependencies

- **Internal:** `../src-tauri/tauri.conf.json` — canonical package identifier.
- **External:** Node built-ins — URL parsing, filesystem reads, and IP-address classification.

## Important Notes / NEVER Change

- 2026-10-03: Node's `console`, `process`, and `URL` are imported explicitly so repository lint recognizes the checker runtime. Scoped lint and existing release-config tests pass; validation behavior is unchanged.

- The checker reads `identifier` from the canonical Tauri config rather than a
  duplicate constant. Keep release-specific validation out of dev/build gates.
- It classifies literal IP ranges and hostname syntax locally; it does not make
  network requests or claim that DNS points to a reachable server.
- Import Node console, process and URL explicitly so the shared ESLint gate
  recognizes the standalone script's runtime names without changing behavior.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Added tested explicit desktop release config preflight | Codex |
| 2026-10-12 | Updater env pair validation (paired presence, HTTPS + `{{current_version}}`, token warnings, base64 pubkey) + `buildUpdaterConfigOverlay` + `warnings` in the result | Devin |
| 2026-10-12 | Review fixes: endpoint host must be publicly reachable (same `isLocalOrReservedHost` check as the app URL; suffix list now covers `.corp`/`.home`/`.home.arpa`/`.lan`), overlay trims env values | Devin |
| 2026-10-16 | `{{channel}}` placeholder accepted in the updater endpoint for stable/beta feed URLs (path/hostname cases covered in `tests/desktop-release-config.test.ts`) | Devin |
