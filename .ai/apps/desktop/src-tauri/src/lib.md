# apps/desktop/src-tauri/src/lib.rs

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

2026-10-12: signed desktop update path + launch-at-login — updater/process/
dialog/autostart plugins, `check_for_updates` (interactive + startup modes),
app-menu "Check for Updates…" and a synced "Launch at Login" check item. The
committed `plugins.updater` block must stay present-but-empty: the plugin
fails init when the key is missing `pubkey`, which would prevent startup.

2026-10-04: allow the exact configured Tauri dev-server
origin as a shell document. The existing guard rejects the startup URL and
leaves WebView2 at about:blank. Verified with a failing-then-passing navigation test and
native Windows startup; retain all app/external origin boundaries.

Tauri shell runtime — creates the main window on a bundled boot page that
probes then loads the web app, plus system tray, global hotkey, close-to-tray,
single-instance behavior, native menus, exact-origin navigation, validated
deep-link routing, window-state memory, an offline banner, a signed-update
check with native confirm/info dialogs, and an OS-backed launch-at-login
toggle.

## What It Does

- `resolve_app_url_from(runtime, compiled)` — pure URL picker: first non-empty,
  valid credential-free `http(s)` candidate wins; else
  `http://localhost:3000`. Unit-tested.
- `is_internal_navigation(app_url, candidate)` — only a credential-free
  HTTP(S) candidate with the configured app's exact effective origin (scheme,
  host, port) stays in-shell. Unit-tested.
- `resolve_deep_link(app_url, candidate)` — accepts `supastack://` routes and
  maps them onto the configured app origin. `supastack://workspace/settings`
  maps to `/workspace/settings`; `supastack:///settings` maps to `/settings`.
  Credentials, explicit ports, other schemes, and invalid app origins are
  rejected. Query strings and fragments are retained; traversal stays on the
  configured host. Unit-tested.
- `is_safe_external_navigation(candidate)` — allows credential-free HTTP(S),
  `mailto:`, and `tel:` links to the system opener. Other schemes are
  cancelled. Unit-tested.
- `is_shell_document(url, dev_url)` — bundled shell chrome stays in-shell: `tauri:`
  scheme URLs (macOS/Linux App URLs) plus `http(s)://tauri.localhost`
  (Windows App URLs), plus the exact resolved development-server origin. Checked first in `on_navigation` so the boot page can
  load and retry. Unit-tested.
- `boot_init_script(target, startup_zoom)` — the one initialization script
  injected into every document: `window.__SUPASTACK_APP_URL__ = <json>`
  (serde_json-encoded startup URL the boot page reads), the
  `zoom_init_script` segment, then `OFFLINE_BANNER_SCRIPT`. Unit-tested.
- Zoom persistence — the factor stays a `style.zoom` eval (one code path
  across WKWebView/WebView2/WebKitGTK) but is now shared state in an
  `Arc<Mutex<f64>>` and survives restarts: `save_zoom`/`load_zoom` write and
  read a `zoom-state.json` sidecar (`{"zoom": 1.3}`) in `app_config_dir()`
  (window-state covers geometry only); `normalize_zoom` rounds to two
  decimals and clamps `ZOOM_MIN..=ZOOM_MAX` (0.3–3.0, step 0.1, default
  1.0) so step arithmetic and hand-edits cannot poison the file.
  Re-application after navigation/reload is layered: the init script bakes
  the startup factor and upgrades it from `localStorage['supastack:zoom']`
  (same-origin, pre-paint), `zoom_apply_script` evals set the style and
  refresh that key, and `on_page_load(Finished)` re-evals the live factor
  on every document — the authoritative fix for cross-origin loads where
  the baked value is stale. All helpers unit-tested; corrupt/missing state
  falls back to the default and save failures only `eprintln!`.
- `update_available_message(version)` — pure dialog copy for a pending
  update ("Version X is available. Install and restart?"). Unit-tested.
- Update channels (stable/beta): `UpdateChannel` (`parse`/`as_str`),
  `channels_supported(templates)` (any `{{channel}}` placeholder),
  `channel_endpoints(templates, channel)` (token → `stable`/`beta`,
  non-templated entries pass through), `pick_channel(env, persisted)`
  (recognized env wins, garbage/blank falls through),
  `load/save_update_channel` (plain-text `update-channel` sidecar in
  `app_config_dir()`, missing/corrupt → Stable), `resolve_update_channel`
  (`SUPASTACK_UPDATE_CHANNEL` env → persisted → Stable),
  `configured_endpoint_templates` (raw `plugins.updater.endpoints`
  strings from `app.config().plugins.0`). All pure/file parts unit-tested.
- `check_for_updates(app, interactive)` — one updater pass, serialized by
  the `UPDATE_CHECK_RUNNING` `AtomicBool` + `UpdateCheckGuard` (Drop resets)
  so a menu tap during the background probe drops instead of stacking
  dialogs. When the configured templates support channels the updater is
  rebuilt via `updater_builder().endpoints(channel-resolved Urls)` —
  unparseable templates are dropped, an empty result still lands in the
  `EmptyEndpoints` unconfigured path; plain endpoints keep `app.updater()`.
  `Err` → non-interactive logs once / interactive shows "not configured"
  (when the cause is `Error::EmptyEndpoints`) or a generic failure dialog.
  `check()` `Ok(Some)` → confirm dialog → `download_and_install` (no-op
  progress callbacks) → `app.restart()`; `Ok(None)` → interactive
  "You're up to date", non-interactive logs; `Err` → log + interactive
  failure dialog. All failures are non-fatal; `blocking_show` is used only
  from spawned async-runtime tasks, never the main thread.
- `build_menu(app, launch_at_login, beta_updates, channels_supported)` —
  native menu bar: app menu (About,
  Check for Updates…, Beta Updates + Launch at Login `CheckMenuItem`s, Quit), Edit
  (`PredefinedMenuItem` undo/redo/separator/cut/copy/paste/select-all),
  Navigate (Home/Back/Forward/Reload), View (Zoom In/Out/Actual Size/Full
  Screen), Window (Minimize/Close-to-tray). The Edit submenu ships on every
  platform: on macOS its predefined roles are what route Cmd+C/V/X/Z/A into
  the webview's responder chain, and on Windows muda replays the shortcuts
  natively. Predefined items emit no menu event, so `handle_menu_event`
  needs no ids for them. `handle_menu_event` dispatches by item id;
  zoom factor is tracked in a `Mutex<f64>` and applied via
  `document.documentElement.style.zoom` eval. `app.check_updates` spawns the
  interactive updater pass; `app.beta_updates` persists the toggled channel
  (env override still wins for the run — logged), re-syncs the check state
  from `resolve_update_channel`, then spawns an interactive check;
  `app.autostart` toggles
  `autolaunch().enable()/disable()` and re-syncs the check state from
  `is_enabled()` via `menu.get(event.id())` — falling back to the flipped
  state on toggle success / the prior state on failure when the re-read
  fails.
- `run()` — registers the dialog, process, updater
  (`Builder::new().build()`), and autostart
  (`init(MacosLauncher::LaunchAgent, None)`) plugins alongside the existing
  ones. `setup()` seeds the Launch at Login item from
  `autolaunch().is_enabled()` (unwrap_or(false)) and spawns one
  non-interactive `check_for_updates` on `tauri::async_runtime` after the
  window exists — a slow or unreachable endpoint never delays startup.
- `run()` — `setup()` builds `main` window via `WebviewUrl::App("index.html")`
  (1200×800) — the bundled boot page probes then redirects to the resolved
  startup route — with `initialization_script(boot_init_script(startup_url))`
  and `on_navigation` (shell documents stay in-shell first, then exact app
  origin; safe external URLs use `app.opener()`; all other schemes are
  cancelled). It wires `CloseRequested → hide` (close-to-tray), tray menu
  (Show/Quit, left-click toggles), `CmdOrCtrl+Shift+Space` global shortcut
  (registration failure logs a warning via `eprintln!` and setup continues —
  tray/menu still summon), single-instance focus and Windows/Linux deep-link
  argv routing, macOS `deep_link().on_open_url` routing, and `set_menu` +
  `on_menu_event`.
- `PendingDeepLink` holds a validated route briefly if a link arrives before
  the main window exists; after window creation it is applied to that same app
  origin.
- `OFFLINE_BANNER_SCRIPT` — injected at document start: full-screen
  offline overlay with a Retry button (`window.location.reload()`); shown on
  the `offline` event or when `navigator.onLine` is false at load, auto-hides
  and reloads on `online`. Shell chrome only — no product UI fork.

## Important Notes / NEVER Change

- Desktop loads the **hosted web app** — no local product UI here (AGENTS.md
  boundary). `apps/desktop/ui/index.html` is the bundled boot page the window
  loads first; it reads `__SUPASTACK_APP_URL__`, probes the app URL, and
  redirects (or shows a text-only unreachable-app retry state).
- `app.windows` in tauri.conf.json stays empty — the window is created in
  `setup()` so the URL can be resolved at runtime.
- Env precedence: `SUPASTACK_APP_URL` runtime → compile-time `option_env!` →
  default; values with credentials are skipped. Hotkey:
  `SUPASTACK_DESKTOP_HOTKEY` → `CmdOrCtrl+Shift+Space`.
- `tray-icon` tauri feature is required for `TrayIconBuilder`.
- `on_navigation` returning `false` cancels the in-webview load. Only allow
  HTTP(S), `mailto:`, and `tel:` links through `opener().open_url`; never forward
  executable or local-content schemes.
- Plugins: single-instance (with its `deep-link` feature enabled), deep-link
  (`supastack://` scheme registered in tauri.conf.json), window-state (restores
  size/position), opener, global-shortcut, dialog, process, updater, autostart.
- The hosted webview receives no `deep-link:default` JavaScript permission;
  route parsing and validation remain in Rust.
- `generate_context!` requires `serde_json` as a direct dependency.
- Updater config boundary (verified against vendored plugin sources):
  `plugins.updater` must deserialize — `pubkey` is a required field and an
  absent/invalid block makes the plugin's `initialize` fail, which aborts app
  startup. The committed config therefore ships `"endpoints": [], "pubkey": ""`;
  `UpdaterBuilder::new` is `pub(crate)`, so `app.updater()` (managed plugin
  state) is the only public construction path. Products inject real values via
  `tauri build --config` / `TAURI_CONFIG` — see docs/desktop-updates.md.
- Capabilities unchanged: the new plugins are driven from Rust, not JS IPC, so
  `capabilities/default.json` needs no extra permissions.
- `handle_menu_event` stays sync; async work (`check_for_updates`) is spawned
  onto `tauri::async_runtime` with a cloned `AppHandle`. `app.restart()` is
  core tauri and returns `!` — call it only after install succeeds.

## Agent Decisions / Thoughts

- 2026-09-20 Devin: chose webview-over-remote (not bundled SPA) so auth/chat
  stay same-origin and identical to web — mobile's better-auth/expo token path
  not needed. `setup()` takes `&mut App`, so `build_tray` gets `app.handle()`.
- 2026-09-28 Devin: zoom via `style.zoom` eval (not webview zoom APIs) keeps
  one code path across WKWebView/WebView2/WebKitGTK. `on_menu_event` takes
  `Fn` (not `FnMut`), so zoom state lives in `Mutex`.
- 2026-10-01 Codex: incoming deep links must be treated as untrusted input and
  mapped onto the configured app origin. Startup uses `get_current`; macOS
  runtime events use `on_open_url`; Windows/Linux second-instance argv are
  parsed directly, with Tauri's single-instance `deep-link` feature enabled.
  Exact-origin navigation and an allowlist for external schemes keep the
  webview boundary aligned with the configured app origin.
- 2026-10-02 Devin: the window boots a bundled `index.html` instead of the
  external app URL because initialization scripts need a loaded document — a
  dead server showed the webview's raw connection error and the offline banner
  could never run. The boot page owns reachability probing and the friendly
  retry state; `is_shell_document` precedes the internal/external checks so
  its reloads stay in-shell. Hotkey registration soft-fails (`eprintln!`, no
  new deps) because a claimed hotkey must not block app startup — the tray
  icon and menu are the fallback summon path.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-20 | Initial scaffold: window/tray/hotkey/single-instance + URL resolution tests | Devin |
| 2026-09-28 | Native menus, external-link interception, deep-link summon, window-state plugin, offline banner script, `is_internal_navigation` tests | Devin |
| 2026-10-01 | Deep links route to the configured app origin; navigation uses exact-origin and external-scheme checks | Codex |
| 2026-10-02 | Window boots bundled `ui/index.html` (probe + redirect to the app URL); `__SUPASTACK_APP_URL__` injection, `is_shell_document` nav allowance, hotkey registration soft-fail, +2 unit tests | Devin |
| 2026-10-12 | Update path + launch-at-login: dialog/process/updater/autostart plugins, `check_for_updates` (interactive + background), "Check for Updates…" + "Launch at Login" app-menu items, `update_available_message` test | Devin |
| 2026-10-12 | Review fixes: `UPDATE_CHECK_RUNNING` AtomicBool + Drop guard dedupes concurrent checks; autostart toggle falls back to the flipped state when the re-read fails | Devin |
| 2026-10-13 | Edit submenu added between the app menu and Navigate — predefined undo/redo/cut/copy/paste/select-all roles restore macOS clipboard/editing shortcuts inside webview inputs | Devin |
| 2026-10-13 | Zoom persists: `zoom-state.json` sidecar in `app_config_dir()`, baked into the init script, carried same-origin via `localStorage`, re-applied on `on_page_load(Finished)`; `normalize_zoom`/`decode_zoom_state`/`zoom_*_script` helpers + 4 unit tests | Devin |
| 2026-10-16 | Update channels: `UpdateChannel` + `{{channel}}` endpoint resolution via `updater_builder().endpoints()`, persisted `update-channel` sidecar + `SUPASTACK_UPDATE_CHANNEL` env override, "Beta Updates" app-menu item (disabled without a channel template, toggling persists + runs an interactive check); 5 unit tests | Devin |
