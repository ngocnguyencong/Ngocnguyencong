# Desktop updates

The desktop shell (`apps/desktop`) can check for and install signed updates of
its own native installers. The wiring lives in Rust
(`apps/desktop/src-tauri/src/lib.rs`); this guide covers what a product needs
to supply at release time — signing keys, an update endpoint, and the
build-time config injection — plus the launch-at-login preference that ships
alongside the updater in the app menu.

## What ships in the shell

- **Check for Updates…** — app-menu item that runs one interactive check:
  available update → confirm → download/install → restart; no update →
  "You're up to date"; unconfigured build → "Updates aren't configured for
  this build."
- **Beta Updates** — app-menu checkbox for release channels. It is enabled
  only when the configured endpoint carries the `{{channel}}` placeholder
  (below); checking it switches the shell to the beta feed, persists the
  choice, and immediately runs an interactive check. Without a
  `{{channel}}` template the item stays disabled — one feed serves
  everyone.
- **Launch at Login** — app-menu checkbox synced with the OS auto-start
  state (macOS launch agent, Windows Run key, Linux autostart entry).
- **Background check** — one non-interactive check runs on the async runtime
  after startup. It never delays the window and only surfaces a dialog when
  an update is actually available.

The committed `tauri.conf.json` carries an empty updater block
(`"endpoints": [], "pubkey": ""`). The block must exist: the updater plugin
fails to initialize when `plugins.updater` is absent or missing `pubkey`, and
the app would not start. The empty values are a placeholder — real values go
in at build time (below), never into the repo.

## 1. Generate a signing keypair

Once, per product:

```bash
pnpm tauri signer generate -w ~/.tauri/product.key
```

This writes the private key to `~/.tauri/product.key` (outside the repo) and
prints the public key. Set a strong password when prompted.

- **Private key + password → CI secrets** — e.g.
  `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret
  entries. `tauri build` reads those env vars to sign artifacts. Never commit
  either to the repository.
- **Public key → build-time config** — it is safe to store; it goes into the
  updater overlay shown below.

## 2. Choose an update endpoint

The updater polls a static JSON manifest. A typical endpoint:

```
https://releases.example.com/{{target}}/{{arch}}/{{current_version}}
```

`{{target}}` (`windows`/`darwin`/`linux`), `{{arch}}`, and
`{{current_version}}` are filled in by the updater at check time; the URL
must be HTTPS, and the release checker requires `{{current_version}}`
in the endpoint it injects (a static manifest URL works for the plugin
but is rejected by the release check). Host the manifest anywhere static
files can be served (object storage, CDN, GitHub-style release pages,
or your own route).

### Release channels (stable / beta)

The endpoint may also carry a `{{channel}}` placeholder in the path:

```
https://releases.example.com/{{channel}}/{{target}}/{{arch}}/{{current_version}}
```

The shell substitutes `stable` or `beta` before each check, so publish two
manifest trees — `…/stable/{{target}}/…` for general releases and
`…/beta/{{target}}/…` for pre-releases. The placeholder only belongs in
the path: the release checker still requires a real public host, so a
channel in the hostname is rejected. When at least one configured endpoint
has `{{channel}}`, the app menu enables **Beta Updates**; the chosen
channel persists in the app config dir and applies to the next check.
`SUPASTACK_UPDATE_CHANNEL=beta` (or `stable`) overrides the persisted
choice for that run — handy for testing a beta build without leaving it.
Endpoints without the placeholder need no per-channel publishing: the
shell skips channel resolution entirely and the menu item stays disabled.

The response is a `latest.json` document:

```json
{
  "version": "1.2.3",
  "notes": "Short release summary.",
  "pub_date": "2026-10-15T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<base64 minisign signature>",
      "url": "https://releases.example.com/1.2.3/app-setup.exe"
    },
    "darwin-aarch64": {
      "signature": "<base64 minisign signature>",
      "url": "https://releases.example.com/1.2.3/app-macos-arm64.zip"
    }
  }
}
```

`signature` is the `.sig` file `tauri build` emits next to each installer
when updater artifacts are enabled; `url` points at the published installer.
Update the manifest (and upload the artifacts) as part of the release job.

## 3. Inject the updater config at build time

`apps/desktop/scripts/check-release-config.mjs` validates the release
environment and prints the overlay JSON when both updater variables are set:

```bash
SUPASTACK_APP_URL="https://app.example.com" \
SUPASTACK_UPDATER_ENDPOINT="https://releases.example.com/{{target}}/{{arch}}/{{current_version}}" \
SUPASTACK_UPDATER_PUBKEY="<public key from step 1>" \
node apps/desktop/scripts/check-release-config.mjs
```

The endpoint and pubkey are required as a pair; the checker also warns when
the endpoint lacks the documented `{{target}}`/`{{arch}}` placeholders. Feed
the printed overlay to the bundler, plus `createUpdaterArtifacts` so
signatures are produced:

```bash
pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":true},"plugins":{"updater":{"endpoints":["https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"],"pubkey":"<public key>"}}'
```

Equivalent option: put the same JSON in the `TAURI_CONFIG` environment
variable for the build process. Both forms deep-merge over the committed
`tauri.conf.json`, so the shipped placeholder keeps working for unsigned
development builds.

Always supply `pubkey` and `endpoints` together — an endpoints-only overlay
merges over the shipped placeholder and keeps its empty `pubkey`, so update
checks appear to work but installs fail signature verification.

## 4. Publish releases

A release job is then:

1. `tauri build` with the overlay (and `TAURI_SIGNING_PRIVATE_KEY*` secrets
   exported) → installers + `.sig` files under
   `apps/desktop/src-tauri/target/release/bundle/`.
2. Upload each installer and its signature.
3. Update `latest.json` on the endpoint with the new `version`, platform
   entries, signatures, and URLs.

Older installs pick the release up on their next launch or via Check for
Updates…; the download is verified against the public key before install.

## Without an endpoint

Nothing breaks: the placeholder config leaves the updater unconfigured, the
background check logs and returns, and Check for Updates… shows
"Updates aren't configured for this build." Launch at Login keeps working —
it is independent of the updater.
