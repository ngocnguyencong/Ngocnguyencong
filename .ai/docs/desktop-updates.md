# docs/desktop-updates.md

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Operator guide for the desktop shell's signed update path: generating a
minisign keypair, hosting the `latest.json` endpoint, and injecting
`plugins.updater` pubkey/endpoints at build time — plus the launch-at-login
menu item that ships alongside the updater.

## What It Does

- Documents the shipped surface: "Check for Updates…" (interactive dialog
  flow), "Launch at Login" (OS-synced `CheckMenuItem`), and one background
  non-interactive check after startup.
- Step 1 — `pnpm tauri signer generate` once per product; private key and
  password live in CI secrets (`TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), never in the repo.
- Step 2 — HTTPS endpoint containing `{{target}}`/`{{arch}}`/
  `{{current_version}}` serving a `latest.json` manifest
  (`version`, `notes`, `pub_date`, `platforms.<os>-<arch>.{signature,url}`);
  optional `{{channel}}` token lets one template fan out to stable and
  beta `latest.json` feeds (stable-only when absent).
- Update channels — the shell substitutes `stable`/`beta` into the
  endpoint at check time; per-install choice persists in an
  `update-channel` config sidecar, `SUPASTACK_UPDATE_CHANNEL` overrides it
  for the run, and the "Beta Updates" menu item (disabled when no
  endpoint carries `{{channel}}`) toggles the channel and re-checks
  interactively.
- Step 3 — `check-release-config.mjs` validates
  `SUPASTACK_UPDATER_ENDPOINT` + `SUPASTACK_UPDATER_PUBKEY` (required as a
  pair) and prints the `plugins.updater` overlay; build with
  `tauri build --config` (or `TAURI_CONFIG`) plus
  `"bundle":{"createUpdaterArtifacts":true}` (default is false).
- Step 4 — release job: build → upload installers + `.sig` files → update
  `latest.json`.
- Notes the no-endpoint path stays safe: unconfigured updater logs/prompts
  "not configured" and never breaks the shell.

## Important Notes / NEVER Change

- States the sentinel contract: the committed `tauri.conf.json` keeps
  `"updater": {"endpoints": [], "pubkey": ""}` because the updater plugin
  aborts startup when `plugins.updater` is absent or lacks `pubkey`; an
  endpoints-only overlay merges over the sentinel and leaves the empty
  pubkey, so checks appear to work but installs fail signature
  verification — the overlay must supply pubkey and endpoints together.
  The `{{current_version}}` requirement is the release checker's rule, not
  the plugin's (a static manifest URL works natively but fails preflight).
- Neutral product-agnostic wording — `releases.example.com` placeholders
  only, no real key material or endpoints.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-12 | Created with the update-path + launch-at-login guide | Devin |
| 2026-10-16 | Update channels section: `{{channel}}` endpoint token, per-channel `latest.json` feeds, `SUPASTACK_UPDATE_CHANNEL` override, "Beta Updates" menu behavior | Devin |
