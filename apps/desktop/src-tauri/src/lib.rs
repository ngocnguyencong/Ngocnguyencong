use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, MenuItemKind, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::PageLoadEvent,
    AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const DEFAULT_APP_URL: &str = "http://localhost:3000";
const DEFAULT_HOTKEY: &str = "CmdOrCtrl+Shift+Space";
const MAIN_WINDOW: &str = "main";

/// Full-screen offline banner injected at document start. Shown on the
/// `offline` event or when the initial load fails; hidden on `online`.
const OFFLINE_BANNER_SCRIPT: &str = r#"
(function () {
  function banner() {
    var el = document.getElementById('__supastack_offline__');
    if (el) return el;
    el = document.createElement('div');
    el.id = '__supastack_offline__';
    el.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:12px;background:#101418;' +
      'color:#e6edf3;font:15px/1.5 system-ui,sans-serif;text-align:center;padding:24px;';
    el.innerHTML =
      '<strong style="font-size:20px">You\'re offline</strong>' +
      '<span style="max-width:32ch;opacity:.75">The app needs a connection. Check your network and try again.</span>' +
      '<button id="__supastack_retry__" style="margin-top:8px;padding:10px 22px;font-size:15px;' +
      'font-weight:600;border:0;border-radius:10px;background:#d55f2a;color:#fff;cursor:pointer">Retry</button>';
    document.documentElement.appendChild(el);
    el.querySelector('#__supastack_retry__').addEventListener('click', function () {
      window.location.reload();
    });
    return el;
  }
  function hide() {
    var el = document.getElementById('__supastack_offline__');
    if (el) el.remove();
  }
  window.addEventListener('offline', banner);
  window.addEventListener('online', function () {
    hide();
    window.location.reload();
  });
  if (!navigator.onLine) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', banner);
    } else {
      banner();
    }
  }
})();
"#;

/// Picks the web app URL the shell loads. Runtime `SUPASTACK_APP_URL` wins over
/// the compile-time value; empty or non-HTTP(S) candidates are skipped.
pub fn resolve_app_url_from(runtime: Option<&str>, compiled: Option<&str>) -> String {
    for candidate in [runtime, compiled].into_iter().flatten() {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(parsed) = Url::parse(trimmed) {
            if matches!(parsed.scheme(), "http" | "https")
                && parsed.username().is_empty()
                && parsed.password().is_none()
            {
                return parsed.to_string();
            }
        }
    }
    DEFAULT_APP_URL.to_string()
}

/// True when `candidate` has the exact configured HTTP(S) origin. This keeps
/// protocol, port, and hostname boundaries aligned with the hosted app.
pub fn is_internal_navigation(app_url: &Url, candidate: &Url) -> bool {
    if !matches!(app_url.scheme(), "http" | "https")
        || app_url.host_str().is_none()
        || !matches!(candidate.scheme(), "http" | "https")
        || candidate.host_str().is_none()
        || !app_url.username().is_empty()
        || app_url.password().is_some()
        || !candidate.username().is_empty()
        || candidate.password().is_some()
    {
        return false;
    }
    candidate.origin() == app_url.origin()
}

/// Maps a `supastack://` route onto the configured HTTP(S) app origin.
/// Authority URLs use the host as the first route segment, so
/// `supastack://workspace/settings` maps to `/workspace/settings`; path-only
/// URLs such as `supastack:///settings` map directly to `/settings`.
pub fn resolve_deep_link(app_url: &Url, candidate: &str) -> Option<Url> {
    if !matches!(app_url.scheme(), "http" | "https")
        || app_url.host_str().is_none()
        || !app_url.username().is_empty()
        || app_url.password().is_some()
    {
        return None;
    }

    let deep_link = Url::parse(candidate).ok()?;
    if deep_link.scheme() != "supastack"
        || deep_link.cannot_be_a_base()
        || !deep_link.username().is_empty()
        || deep_link.password().is_some()
        || deep_link.port().is_some()
    {
        return None;
    }

    let mut path = String::new();
    if let Some(route) = deep_link.host_str() {
        path.push('/');
        path.push_str(route);
    }
    path.push_str(deep_link.path());
    if path.is_empty() {
        path.push('/');
    } else if !path.starts_with('/') {
        path.insert(0, '/');
    }

    let mut target = app_url.clone();
    target.set_path(&path);
    target.set_query(deep_link.query());
    target.set_fragment(deep_link.fragment());
    Some(target)
}

/// Only ordinary web and contact links leave the app through the system
/// opener. Schemes that can execute or load local content stay blocked.
pub fn is_safe_external_navigation(candidate: &Url) -> bool {
    match candidate.scheme() {
        "http" | "https" => {
            candidate.host_str().is_some()
                && candidate.username().is_empty()
                && candidate.password().is_none()
        }
        "mailto" | "tel" => !candidate.path().is_empty(),
        _ => false,
    }
}

/// Shell chrome documents — the bundled `ui/` pages under `frontendDist` —
/// always stay in-shell so the boot page can load, probe, and retry. Tauri
/// serves App URLs as `tauri://localhost/…` on macOS/Linux and as
/// `http(s)://tauri.localhost/…` on Windows. During development the CLI
/// serves frontendDist at the exact configured devUrl origin instead.
fn is_shell_document(url: &Url, dev_url: Option<&Url>) -> bool {
    url.scheme() == "tauri"
        || (matches!(url.scheme(), "http" | "https") && url.host_str() == Some("tauri.localhost"))
        || dev_url.is_some_and(|dev| is_internal_navigation(dev, url))
}

/// Builds the script injected into every document. The bundled boot page
/// reads `__SUPASTACK_APP_URL__` to learn which app URL to probe and load;
/// the offline banner keeps working on the real app page afterwards. The
/// `startup_zoom` segment re-applies the persisted factor at document start
/// so full navigations keep it before first paint.
fn boot_init_script(target: &str, startup_zoom: f64) -> String {
    let encoded = serde_json::to_string(target).expect("encoding a string cannot fail");
    format!(
        "window.__SUPASTACK_APP_URL__ = {encoded};\n{}{OFFLINE_BANNER_SCRIPT}",
        zoom_init_script(startup_zoom)
    )
}

fn resolve_app_url() -> String {
    resolve_app_url_from(
        std::env::var("SUPASTACK_APP_URL").ok().as_deref(),
        option_env!("SUPASTACK_APP_URL"),
    )
}

fn resolve_hotkey() -> Shortcut {
    let raw = std::env::var("SUPASTACK_DESKTOP_HOTKEY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_HOTKEY.to_string());
    raw.parse::<Shortcut>()
        .unwrap_or_else(|_| DEFAULT_HOTKEY.parse().expect("default hotkey must parse"))
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[derive(Default)]
struct PendingDeepLink(std::sync::Mutex<Option<Url>>);

fn navigate_main_window(app: &AppHandle, target: Url) {
    if let Some(window) = main_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        if !window.url().is_ok_and(|current| current == target) {
            let _ = window.navigate(target);
        }
        let _ = window.set_focus();
    } else if let Some(pending) = app.try_state::<PendingDeepLink>() {
        *pending.0.lock().expect("pending deep-link lock poisoned") = Some(target);
    }
}

fn route_deep_link(app: &AppHandle, app_url: &Url, candidate: &str) -> bool {
    if let Some(target) = resolve_deep_link(app_url, candidate) {
        navigate_main_window(app, target);
        true
    } else {
        false
    }
}

/// Summon-or-hide semantics: a hidden/minimized window appears focused, a
/// visible-but-unfocused window gets focus, a focused window hides to tray.
fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let visible = window.is_visible().unwrap_or(false);
        let focused = window.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = window.hide();
        } else {
            show_main_window(app);
        }
    }
}

fn eval_in_main(app: &AppHandle, script: &str) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.eval(script);
    }
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW)
}

const UPDATE_NOT_CONFIGURED_MESSAGE: &str = "Updates aren't configured for this build.";
const UPDATE_CHECK_FAILED_MESSAGE: &str = "The update check failed. Try again later.";
const UPDATE_INSTALL_FAILED_MESSAGE: &str = "The update could not be installed. Try again later.";
const UPDATE_UP_TO_DATE_MESSAGE: &str = "You're up to date.";

/// Serializes update checks — the startup probe and the menu item can
/// overlap; a second check drops instead of stacking dialogs.
static UPDATE_CHECK_RUNNING: AtomicBool = AtomicBool::new(false);

struct UpdateCheckGuard;

impl Drop for UpdateCheckGuard {
    fn drop(&mut self) {
        UPDATE_CHECK_RUNNING.store(false, Ordering::SeqCst);
    }
}

/// Dialog text for a pending update — kept pure so the wording stays
/// unit-testable.
fn update_available_message(version: &str) -> String {
    format!("Version {version} is available. Install and restart?")
}

/// Release channel a configured `{{channel}}` endpoint template resolves to.
/// `stable` is the default; `beta` opts into pre-release feeds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UpdateChannel {
    Stable,
    Beta,
}

impl UpdateChannel {
    fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "stable" => Some(Self::Stable),
            "beta" => Some(Self::Beta),
            _ => None,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Stable => "stable",
            Self::Beta => "beta",
        }
    }
}

/// Placeholder an endpoint template may carry for per-channel feeds.
const UPDATE_CHANNEL_TOKEN: &str = "{{channel}}";
/// Plain-text sidecar (next to `zoom-state.json`) holding the menu choice.
const UPDATE_CHANNEL_FILENAME: &str = "update-channel";
/// Runtime env override — wins over the persisted channel for that run.
const UPDATE_CHANNEL_ENV: &str = "SUPASTACK_UPDATE_CHANNEL";

/// Channel-aware endpoints only exist when at least one configured template
/// carries the placeholder — otherwise the single feed serves both groups.
fn channels_supported(templates: &[String]) -> bool {
    templates.iter().any(|t| t.contains(UPDATE_CHANNEL_TOKEN))
}

/// Substitutes the channel into every template; templates without the
/// placeholder pass through unchanged.
fn channel_endpoints(templates: &[String], channel: UpdateChannel) -> Vec<String> {
    templates
        .iter()
        .map(|template| template.replace(UPDATE_CHANNEL_TOKEN, channel.as_str()))
        .collect()
}

fn update_channel_path(config_dir: &std::path::Path) -> std::path::PathBuf {
    config_dir.join(UPDATE_CHANNEL_FILENAME)
}

/// Persisted channel, defaulting to Stable on a missing/unreadable sidecar.
fn load_update_channel(config_dir: &std::path::Path) -> UpdateChannel {
    std::fs::read_to_string(update_channel_path(config_dir))
        .ok()
        .and_then(|raw| UpdateChannel::parse(&raw))
        .unwrap_or(UpdateChannel::Stable)
}

fn save_update_channel(config_dir: &std::path::Path, channel: UpdateChannel) -> std::io::Result<()> {
    std::fs::create_dir_all(config_dir)?;
    std::fs::write(update_channel_path(config_dir), channel.as_str())
}

/// Precedence for the effective channel — a recognized env value wins for
/// the run, otherwise the persisted choice stands. Blank/garbage env values
/// fall through to the persisted channel instead of silently resetting it.
fn pick_channel(env_value: Option<&str>, persisted: UpdateChannel) -> UpdateChannel {
    env_value
        .and_then(UpdateChannel::parse)
        .unwrap_or(persisted)
}

/// Effective channel: `SUPASTACK_UPDATE_CHANNEL` wins for the run, then the
/// persisted menu choice, then Stable. Read failures resolve to Stable.
fn resolve_update_channel(app: &AppHandle) -> UpdateChannel {
    if let Ok(raw) = std::env::var(UPDATE_CHANNEL_ENV) {
        if UpdateChannel::parse(&raw).is_none() && !raw.trim().is_empty() {
            eprintln!("supastack: ignoring unrecognized {UPDATE_CHANNEL_ENV}={raw:?}");
        }
    }
    let persisted = app
        .path()
        .app_config_dir()
        .map(|dir| load_update_channel(&dir))
        .unwrap_or(UpdateChannel::Stable);
    pick_channel(std::env::var(UPDATE_CHANNEL_ENV).ok().as_deref(), persisted)
}

/// The raw endpoint templates the build-time `--config` overlay injected —
/// read from `plugins.updater.endpoints` so `{{channel}}` can be resolved
/// per the chosen channel before the updater is built.
fn configured_endpoint_templates(app: &AppHandle) -> Vec<String> {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|value| value.get("endpoints"))
        .and_then(|value| value.as_array())
        .map(|endpoints| {
            endpoints
                .iter()
                .filter_map(|endpoint| endpoint.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

/// Runs one update check against the configured endpoint. `interactive`
/// (the Check for Updates menu item) reports every outcome in a native
/// dialog; the background startup check only prompts when an update is
/// actually available — an unconfigured updater, an up-to-date build, or a
/// failed check only logs. Failures are never fatal and never block setup.
async fn check_for_updates(app: &AppHandle, interactive: bool) {
    if UPDATE_CHECK_RUNNING.swap(true, Ordering::SeqCst) {
        eprintln!("supastack: update check already in progress — skipping");
        return;
    }
    let _in_progress = UpdateCheckGuard;
    // The shipped `plugins.updater` config carries only a sentinel (no
    // endpoints, empty pubkey) until a product injects real values through a
    // build-time `--config` overlay — an unconfigured updater fails here with
    // `EmptyEndpoints`; anything else is a genuine fault. Endpoints carrying
    // the `{{channel}}` placeholder are resolved per the effective channel
    // (env override → persisted menu choice → stable) through a rebuilt
    // updater; plain endpoints keep the plugin-configured path.
    let templates = configured_endpoint_templates(app);
    let updater = match if channels_supported(&templates) {
        let channel = resolve_update_channel(app);
        let endpoints: Vec<Url> = channel_endpoints(&templates, channel)
            .iter()
            .filter_map(|raw| Url::parse(raw).ok())
            .collect();
        app.updater_builder()
            .endpoints(endpoints)
            .and_then(|builder| builder.build())
    } else {
        app.updater()
    } {
        Ok(updater) => updater,
        Err(error) => {
            let unconfigured = matches!(error, tauri_plugin_updater::Error::EmptyEndpoints);
            if unconfigured {
                eprintln!("supastack: update check skipped — updater is not configured ({error})");
            } else {
                eprintln!("supastack: updater could not initialize ({error})");
            }
            if interactive {
                app.dialog()
                    .message(if unconfigured {
                        UPDATE_NOT_CONFIGURED_MESSAGE
                    } else {
                        UPDATE_CHECK_FAILED_MESSAGE
                    })
                    .title("Check for Updates")
                    .kind(if unconfigured {
                        MessageDialogKind::Info
                    } else {
                        MessageDialogKind::Error
                    })
                    .blocking_show();
            }
            return;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let install = app
                .dialog()
                .message(update_available_message(&update.version))
                .title("Update Available")
                .kind(MessageDialogKind::Info)
                .buttons(MessageDialogButtons::OkCancelCustom(
                    "Install and Restart".to_string(),
                    "Later".to_string(),
                ))
                .blocking_show();
            if !install {
                return;
            }
            // Progress callbacks are no-ops — the ask dialog only confirms;
            // the platform installer shows its own progress on Windows.
            match update.download_and_install(|_size, _total| {}, || {}).await {
                Ok(()) => app.restart(),
                Err(error) => {
                    eprintln!("supastack: update install failed ({error})");
                    if interactive {
                        app.dialog()
                            .message(UPDATE_INSTALL_FAILED_MESSAGE)
                            .title("Update Failed")
                            .kind(MessageDialogKind::Error)
                            .blocking_show();
                    }
                }
            }
        }
        Ok(None) => {
            if interactive {
                app.dialog()
                    .message(UPDATE_UP_TO_DATE_MESSAGE)
                    .title("Check for Updates")
                    .kind(MessageDialogKind::Info)
                    .blocking_show();
            } else {
                eprintln!("supastack: no update available");
            }
        }
        Err(error) => {
            eprintln!("supastack: update check failed ({error})");
            if interactive {
                app.dialog()
                    .message(UPDATE_CHECK_FAILED_MESSAGE)
                    .title("Check for Updates")
                    .kind(MessageDialogKind::Error)
                    .blocking_show();
            }
        }
    }
}

/// View-menu zoom bounds and step. The factor is a CSS `zoom` multiplier on
/// `document.documentElement` — kept CSS-based (not webview zoom APIs) so
/// WKWebView, WebView2, and WebKitGTK share one code path.
const ZOOM_MIN: f64 = 0.3;
const ZOOM_MAX: f64 = 3.0;
const ZOOM_STEP: f64 = 0.1;
const ZOOM_DEFAULT: f64 = 1.0;
/// `tauri-plugin-window-state` persists window geometry only, so the zoom
/// factor gets its own JSON sidecar in the same `app_config_dir()`.
const ZOOM_STATE_FILENAME: &str = "zoom-state.json";
/// Per-origin webview key the init script reads and the apply eval writes —
/// it carries mid-session zoom changes into documents loaded later on the
/// same origin before first paint, where the baked init value is stale.
const ZOOM_STORAGE_KEY: &str = "supastack:zoom";

/// Snaps a zoom candidate onto a stable, bounded value: non-finite input
/// falls back to the default; the rest is rounded to two decimals so the
/// `ZOOM_STEP` arithmetic does not leak floating-point noise into the
/// persisted JSON or the eval'd CSS, then clamped into `ZOOM_MIN..=ZOOM_MAX`.
fn normalize_zoom(value: f64) -> f64 {
    if !value.is_finite() {
        return ZOOM_DEFAULT;
    }
    ((value * 100.0).round() / 100.0).clamp(ZOOM_MIN, ZOOM_MAX)
}

fn zoom_state_path(config_dir: &std::path::Path) -> std::path::PathBuf {
    config_dir.join(ZOOM_STATE_FILENAME)
}

fn encode_zoom_state(zoom: f64) -> String {
    serde_json::json!({ "zoom": zoom }).to_string()
}

/// Reads a persisted zoom factor. Anything malformed or missing yields `None`
/// so callers fall back to the default; out-of-range values are clamped.
fn decode_zoom_state(raw: &str) -> Option<f64> {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()?
        .get("zoom")?
        .as_f64()
        .map(normalize_zoom)
}

/// Startup zoom: the persisted factor, or the default on a missing/corrupt
/// sidecar (first run included — nothing to log about).
fn load_zoom(config_dir: &std::path::Path) -> f64 {
    std::fs::read_to_string(zoom_state_path(config_dir))
        .ok()
        .and_then(|raw| decode_zoom_state(&raw))
        .unwrap_or(ZOOM_DEFAULT)
}

fn save_zoom(config_dir: &std::path::Path, zoom: f64) -> std::io::Result<()> {
    // The config directory does not exist until something writes into it.
    std::fs::create_dir_all(config_dir)?;
    std::fs::write(zoom_state_path(config_dir), encode_zoom_state(zoom))
}

/// Eval snippet the menu handler and `on_page_load` use to apply a zoom
/// factor: set the style and mirror it into `localStorage` so documents
/// loaded later on the same origin pick it up at document start.
fn zoom_apply_script(zoom: f64) -> String {
    format!(
        "document.documentElement.style.zoom = '{zoom}';\
         try{{localStorage.setItem('{ZOOM_STORAGE_KEY}','{zoom}')}}catch(_){{}}"
    )
}

/// Initialization-script segment that re-applies the zoom at document start.
/// `startup` is the value persisted when the window was built; the
/// `localStorage` read (same-origin only) wins when zoom changed mid-session
/// after this script was baked in.
fn zoom_init_script(startup: f64) -> String {
    format!(
        "(function(){{var z={startup};\
         try{{var s=parseFloat(localStorage.getItem('{ZOOM_STORAGE_KEY}'));\
         if(isFinite(s))z=Math.min(Math.max(s,{ZOOM_MIN}),{ZOOM_MAX})}}catch(_){{}}\
         function a(){{document.documentElement.style.zoom=z}}\
         if(document.documentElement)a();\
         else document.addEventListener('DOMContentLoaded',a)}})();\n"
    )
}

/// Native application menu: app items (About, Check for Updates, Beta
/// Updates, Launch at Login, Quit), Edit (undo/redo/cut/copy/paste/
/// select-all), Navigate (Home/Back/Forward/Reload), View (zoom +
/// fullscreen), and Window (minimize/hide-to-tray). Handled in `setup` via
/// `on_menu_event` against item ids. The Edit submenu is required on
/// macOS — without the standard roles the system never routes
/// Cmd+C/V/X/Z into the webview — and on Windows/Linux the predefined
/// items replay the same shortcuts natively, so it ships on every
/// platform. Beta Updates stays disabled unless the configured endpoints
/// carry the `{{channel}}` placeholder.
fn build_menu(
    app: &AppHandle,
    launch_at_login: bool,
    beta_updates: bool,
    channels_supported: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
    let app_menu = Submenu::with_items(
        app,
        "Supastack",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Supastack"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "app.check_updates",
                "Check for Updates…",
                true,
                None::<&str>,
            )?,
            &CheckMenuItem::with_id(
                app,
                "app.beta_updates",
                "Beta Updates",
                channels_supported,
                beta_updates,
                None::<&str>,
            )?,
            &CheckMenuItem::with_id(
                app,
                "app.autostart",
                "Launch at Login",
                true,
                launch_at_login,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "app.quit", "Quit Supastack", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;

    // Predefined edit items carry native roles — the webview handles them
    // itself and no `on_menu_event` dispatch is needed.
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let navigate = Submenu::with_items(
        app,
        "Navigate",
        true,
        &[
            &MenuItem::with_id(app, "nav.home", "Home", true, Some("CmdOrCtrl+Shift+H"))?,
            &MenuItem::with_id(app, "nav.back", "Back", true, Some("CmdOrCtrl+["))?,
            &MenuItem::with_id(app, "nav.forward", "Forward", true, Some("CmdOrCtrl+]"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "nav.reload", "Reload", true, Some("CmdOrCtrl+R"))?,
        ],
    )?;

    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(app, "view.zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, "view.zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?,
            &MenuItem::with_id(
                app,
                "view.zoom_reset",
                "Actual Size",
                true,
                Some("CmdOrCtrl+0"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "view.fullscreen",
                "Toggle Full Screen",
                true,
                Some("CmdOrCtrl+Ctrl+F"),
            )?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &MenuItem::with_id(
                app,
                "window.minimize",
                "Minimize",
                true,
                Some("CmdOrCtrl+M"),
            )?,
            &MenuItem::with_id(
                app,
                "window.close",
                "Close Window",
                true,
                Some("CmdOrCtrl+W"),
            )?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit, &navigate, &view, &window_menu])
}

/// Menu ids → behavior. `zoom` persists the current factor across menu
/// presses so Zoom In/Out are incremental; every change also writes the
/// `zoom-state.json` sidecar so the factor survives restarts.
fn handle_menu_event(
    app: &AppHandle,
    event: tauri::menu::MenuEvent,
    zoom: &std::sync::Mutex<f64>,
    home_url: &str,
) {
    let apply_zoom = |next: f64| {
        let next = normalize_zoom(next);
        *zoom.lock().expect("zoom lock poisoned") = next;
        eval_in_main(app, &zoom_apply_script(next));
        match app.path().app_config_dir() {
            Ok(dir) => {
                if let Err(error) = save_zoom(&dir, next) {
                    eprintln!("supastack: could not persist the zoom factor ({error})");
                }
            }
            Err(error) => {
                eprintln!(
                    "supastack: could not resolve a config directory for the zoom factor ({error})"
                );
            }
        }
    };
    match event.id().as_ref() {
        "app.quit" => app.exit(0),
        "app.check_updates" => {
            // Menu events arrive on the main thread — the check (network +
            // blocking dialogs) must run on the async runtime instead.
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(&handle, true).await;
            });
        }
        "app.beta_updates" => {
            // Toggle to the opposite of the effective channel and persist
            // it — an env override still wins for this run, so the check
            // state mirrors what the next check actually targets.
            let next = match resolve_update_channel(app) {
                UpdateChannel::Stable => UpdateChannel::Beta,
                UpdateChannel::Beta => UpdateChannel::Stable,
            };
            match app.path().app_config_dir() {
                Ok(dir) => {
                    if let Err(error) = save_update_channel(&dir, next) {
                        eprintln!("supastack: could not persist the update channel ({error})");
                    }
                }
                Err(error) => {
                    eprintln!(
                        "supastack: could not resolve a config directory for the update channel ({error})"
                    );
                }
            }
            if std::env::var_os(UPDATE_CHANNEL_ENV).is_some() {
                eprintln!(
                    "supastack: {UPDATE_CHANNEL_ENV} is set — the saved {} channel applies next run without it",
                    next.as_str()
                );
            }
            if let Some(menu) = app.menu() {
                if let Some(MenuItemKind::Check(item)) = menu.get(event.id()) {
                    let _ = item.set_checked(resolve_update_channel(app) == UpdateChannel::Beta);
                }
            }
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(&handle, true).await;
            });
        }
        "app.autostart" => {
            let autostart = app.autolaunch();
            let enabled = autostart.is_enabled().unwrap_or(false);
            let toggled = if enabled {
                autostart.disable()
            } else {
                autostart.enable()
            };
            if let Err(error) = &toggled {
                eprintln!("supastack: could not update the launch-at-login setting ({error})");
            }
            // macOS toggles the check state natively while other platforms
            // leave it stale — always write the platform's real state back.
            // If the re-read fails, assume a successful toggle flipped it.
            let current = autostart
                .is_enabled()
                .unwrap_or(if toggled.is_ok() { !enabled } else { enabled });
            if let Some(menu) = app.menu() {
                if let Some(MenuItemKind::Check(item)) = menu.get(event.id()) {
                    let _ = item.set_checked(current);
                }
            }
        }
        "nav.home" => {
            if let (Some(window), Ok(url)) = (main_window(app), Url::parse(home_url)) {
                let _ = window.navigate(url);
            }
        }
        "nav.back" => eval_in_main(app, "window.history.back()"),
        "nav.forward" => eval_in_main(app, "window.history.forward()"),
        "nav.reload" => {
            if let Some(window) = main_window(app) {
                let _ = window.eval("window.location.reload()");
            }
        }
        "view.zoom_in" => {
            let next = *zoom.lock().expect("zoom lock poisoned") + ZOOM_STEP;
            apply_zoom(next);
        }
        "view.zoom_out" => {
            let next = *zoom.lock().expect("zoom lock poisoned") - ZOOM_STEP;
            apply_zoom(next);
        }
        "view.zoom_reset" => apply_zoom(ZOOM_DEFAULT),
        "view.fullscreen" => {
            if let Some(window) = main_window(app) {
                let fullscreen = window.is_fullscreen().unwrap_or(false);
                let _ = window.set_fullscreen(!fullscreen);
            }
        }
        "window.minimize" => {
            if let Some(window) = main_window(app) {
                let _ = window.minimize();
            }
        }
        "window.close" => {
            if let Some(window) = main_window(app) {
                let _ = window.hide();
            }
        }
        _ => {}
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show Supastack", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Supastack", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingDeepLink::default())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                if let Ok(app_url) = Url::parse(&resolve_app_url()) {
                    if _argv
                        .iter()
                        .any(|argument| route_deep_link(app, &app_url, argument))
                    {
                        return;
                    }
                }
            }
            show_main_window(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let app_url = resolve_app_url();
            let parsed = Url::parse(&app_url).expect("resolved app URL must parse");

            #[cfg(target_os = "macos")]
            {
                let link_handle = app.handle().clone();
                let link_app_url = parsed.clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    if !urls
                        .iter()
                        .any(|url| route_deep_link(&link_handle, &link_app_url, url.as_str()))
                    {
                        show_main_window(&link_handle);
                    }
                });
            }

            let startup_url = app
                .deep_link()
                .get_current()?
                .and_then(|urls| {
                    urls.into_iter()
                        .find_map(|url| resolve_deep_link(&parsed, url.as_str()))
                })
                .unwrap_or_else(|| parsed.clone());

            // Shell documents (the bundled boot page) and the configured app
            // origin stay inside the webview. Safe external URLs open in the
            // system browser; other schemes are cancelled.
            let nav_app_url = parsed.clone();
            let nav_handle = app.handle().clone();
            let shell_dev_url = app.config().build.dev_url.clone();
            // The zoom factor is shared state: baked into the init script at
            // startup, re-applied after every page load below, updated by the
            // View menu, and written to `zoom-state.json` on each change.
            let initial_zoom = match app.path().app_config_dir() {
                Ok(dir) => load_zoom(&dir),
                Err(error) => {
                    eprintln!(
                        "supastack: could not resolve a config directory; \
                         zoom persistence is disabled ({error})"
                    );
                    ZOOM_DEFAULT
                }
            };
            let zoom = std::sync::Arc::new(std::sync::Mutex::new(initial_zoom));
            let page_load_zoom = std::sync::Arc::clone(&zoom);
            let window =
                WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App("index.html".into()))
                    .title("Supastack")
                    .inner_size(1200.0, 800.0)
                    .initialization_script(boot_init_script(startup_url.as_str(), initial_zoom))
                    .on_navigation(move |url| {
                        if is_shell_document(url, shell_dev_url.as_ref()) {
                            true
                        } else if is_internal_navigation(&nav_app_url, url) {
                            true
                        } else if is_safe_external_navigation(url) {
                            let _ = nav_handle.opener().open_url(url.as_str(), None::<&str>);
                            false
                        } else {
                            false
                        }
                    })
                    // `style.zoom` is per-document — re-apply the live factor
                    // once each page finishes loading so reloads and
                    // navigations keep it even where the init script's baked
                    // value is stale and `localStorage` differs by origin.
                    .on_page_load(move |webview, payload| {
                        if payload.event() == PageLoadEvent::Finished {
                            let current = *page_load_zoom.lock().expect("zoom lock poisoned");
                            let _ = webview.eval(zoom_apply_script(current));
                        }
                    })
                    .build()?;

            if let Some(pending) = app.try_state::<PendingDeepLink>() {
                if let Some(target) = pending
                    .0
                    .lock()
                    .expect("pending deep-link lock poisoned")
                    .take()
                {
                    navigate_main_window(app.handle(), target);
                }
            }

            // The Launch at Login item mirrors the platform state at build
            // time; an unreadable state just starts unchecked. Beta Updates
            // mirrors the effective channel and only engages when the
            // configured endpoints carry the `{{channel}}` placeholder.
            let launch_at_login = app.autolaunch().is_enabled().unwrap_or(false);
            let menu = build_menu(
                app.handle(),
                launch_at_login,
                resolve_update_channel(app.handle()) == UpdateChannel::Beta,
                channels_supported(&configured_endpoint_templates(app.handle())),
            )?;
            app.set_menu(menu)?;

            let window_handle = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_handle.hide();
                }
            });

            let home_url = app_url.clone();
            app.on_menu_event(move |app, event| {
                handle_menu_event(app, event, &zoom, &home_url);
            });

            build_tray(app.handle())?;
            // A claimed hotkey (another app registered it first) must not abort
            // setup — the tray icon and application menu still summon the
            // window.
            let hotkey = resolve_hotkey();
            if let Err(error) = app.global_shortcut().register(hotkey) {
                eprintln!(
                    "supastack: could not register global shortcut {hotkey} ({error}); \
                     use the tray icon or application menu to summon the window"
                );
            }

            // One non-interactive update check after setup — it runs on the
            // async runtime, so a slow or unreachable endpoint never delays
            // the window, and an update dialog only appears when a release is
            // actually newer.
            let update_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(&update_handle, false).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running supastack desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falls_back_to_local_default() {
        assert_eq!(resolve_app_url_from(None, None), "http://localhost:3000");
    }

    #[test]
    fn runtime_env_wins_over_compiled() {
        assert_eq!(
            resolve_app_url_from(
                Some("https://app.example.com"),
                Some("https://ignored.example.com")
            ),
            "https://app.example.com/"
        );
    }

    #[test]
    fn compiled_value_used_when_runtime_missing() {
        assert_eq!(
            resolve_app_url_from(None, Some("https://build.example.com")),
            "https://build.example.com/"
        );
    }

    #[test]
    fn skips_blank_and_non_http_values() {
        assert_eq!(
            resolve_app_url_from(Some("   "), Some("file:///etc/passwd")),
            "http://localhost:3000"
        );
        assert_eq!(
            resolve_app_url_from(Some("not a url"), Some("tauri://localhost")),
            "http://localhost:3000"
        );
        assert_eq!(
            resolve_app_url_from(Some("https://user:secret@unsafe.example.com"), None),
            "http://localhost:3000"
        );
    }

    #[test]
    fn internal_navigation_requires_exact_app_origin() {
        let app = Url::parse("https://app.example.com/home").unwrap();
        assert!(is_internal_navigation(
            &app,
            &Url::parse("https://app.example.com/chat").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("https://api.app.example.com/x").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("http://app.example.com/chat").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("https://app.example.com:8443/chat").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("https://user:secret@app.example.com/chat").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("https://evilapp.example.com").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("https://other.com").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("mailto:a@b.c").unwrap()
        ));
        assert!(!is_internal_navigation(
            &app,
            &Url::parse("javascript:alert(1)").unwrap()
        ));
    }

    #[test]
    fn deep_links_map_routes_to_the_configured_app_origin() {
        let app = Url::parse("https://app.example.com").unwrap();
        assert_eq!(
            resolve_deep_link(&app, "supastack://workspace/settings?tab=billing#plans")
                .unwrap()
                .as_str(),
            "https://app.example.com/workspace/settings?tab=billing#plans"
        );
        assert_eq!(
            resolve_deep_link(&app, "supastack:///auth/callback?code=abc")
                .unwrap()
                .as_str(),
            "https://app.example.com/auth/callback?code=abc"
        );
    }

    #[test]
    fn deep_link_traversal_cannot_change_the_configured_origin() {
        let app = Url::parse("https://app.example.com/base").unwrap();
        let target =
            resolve_deep_link(&app, "supastack://workspace/%2e%2e//other.example/path").unwrap();
        assert_eq!(target.origin(), app.origin());
        assert_eq!(target.host_str(), Some("app.example.com"));
        assert!(target.path().starts_with('/'));
    }

    #[test]
    fn deep_link_parser_rejects_untrusted_authority_details() {
        let app = Url::parse("https://app.example.com").unwrap();
        assert!(resolve_deep_link(&app, "supastack://user:secret@workspace/callback").is_none());
        assert!(resolve_deep_link(&app, "supastack://workspace:8443/callback").is_none());
        assert!(resolve_deep_link(&app, "https://evil.example.com/callback").is_none());
        assert!(resolve_deep_link(&app, "javascript:alert(1)").is_none());
    }

    #[test]
    fn external_navigation_allows_web_and_contact_links_only() {
        assert!(is_safe_external_navigation(
            &Url::parse("https://docs.example.com/guide").unwrap()
        ));
        assert!(is_safe_external_navigation(
            &Url::parse("mailto:help@example.com").unwrap()
        ));
        assert!(is_safe_external_navigation(
            &Url::parse("tel:+15555550123").unwrap()
        ));
        assert!(!is_safe_external_navigation(
            &Url::parse("javascript:alert(1)").unwrap()
        ));
        assert!(!is_safe_external_navigation(
            &Url::parse("data:text/html,hello").unwrap()
        ));
        assert!(!is_safe_external_navigation(
            &Url::parse("https://user:secret@example.com").unwrap()
        ));
    }

    #[test]
    fn boot_init_script_injects_the_json_encoded_app_url() {
        let target = "https://app.example.com/workspace/settings?tab=\"billing\"";
        let script = boot_init_script(target, 1.0);
        assert!(
            script.starts_with("window.__SUPASTACK_APP_URL__ = "),
            "boot script must assign __SUPASTACK_APP_URL__ before anything else"
        );
        let encoded = serde_json::to_string(target).unwrap();
        assert!(script.contains(&format!("window.__SUPASTACK_APP_URL__ = {encoded};")));
        assert!(script.ends_with(OFFLINE_BANNER_SCRIPT));
    }

    #[test]
    fn zoom_normalize_rounds_clamps_and_defaults() {
        // Step arithmetic leaks f64 noise; normalize snaps it back.
        assert_eq!(normalize_zoom(1.0 + ZOOM_STEP + ZOOM_STEP), 1.2);
        assert_eq!(normalize_zoom(3.4), ZOOM_MAX);
        assert_eq!(normalize_zoom(0.05), ZOOM_MIN);
        assert_eq!(normalize_zoom(1.005), ZOOM_DEFAULT);
        for bad in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert_eq!(normalize_zoom(bad), ZOOM_DEFAULT);
        }
    }

    #[test]
    fn zoom_state_roundtrips_through_json() {
        assert_eq!(encode_zoom_state(1.4), "{\"zoom\":1.4}");
        assert_eq!(decode_zoom_state(&encode_zoom_state(0.7)), Some(0.7));
        for bad in ["", "not json", "{}", "{\"zoom\":\"high\"}", "[1.4]"] {
            assert_eq!(decode_zoom_state(bad), None, "input {bad:?}");
        }
        // A hand-edited or stale value is normalized rather than trusted.
        assert_eq!(decode_zoom_state("{\"zoom\":99}"), Some(ZOOM_MAX));
        assert_eq!(decode_zoom_state("{\"zoom\":0}"), Some(ZOOM_MIN));
    }

    #[test]
    fn zoom_state_persists_through_a_config_dir() {
        let dir = std::env::temp_dir().join(format!(
            "supastack-zoom-state-{}-persist",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        // Missing file and missing directory both resolve to the default.
        assert_eq!(load_zoom(&dir), ZOOM_DEFAULT);
        save_zoom(&dir, 1.3).expect("save must create the config dir");
        assert_eq!(load_zoom(&dir), 1.3);
        // A corrupt sidecar falls back to the default instead of failing.
        std::fs::write(zoom_state_path(&dir), "{oops").unwrap();
        assert_eq!(load_zoom(&dir), ZOOM_DEFAULT);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn zoom_scripts_carry_the_factor_and_storage_key() {
        let apply = zoom_apply_script(1.25);
        assert!(apply.contains("document.documentElement.style.zoom = '1.25'"));
        assert!(apply.contains("localStorage.setItem('supastack:zoom','1.25')"));

        let init = zoom_init_script(0.8);
        assert!(init.contains("var z=0.8"));
        assert!(init.contains("localStorage.getItem('supastack:zoom')"));
        // A hand-edited localStorage value is clamped to the same bounds.
        assert!(init.contains(&format!("Math.max(s,{ZOOM_MIN}),{ZOOM_MAX}")));
    }

    #[test]
    fn shell_documents_stay_in_shell() {
        let app = Url::parse("https://app.example.com").unwrap();
        // Bundled App URLs arrive as tauri://localhost/… on macOS/Linux and as
        // http(s)://tauri.localhost/… on Windows.
        assert!(is_shell_document(
            &Url::parse("tauri://localhost/index.html").unwrap(),
            None
        ));
        assert!(is_shell_document(
            &Url::parse("http://tauri.localhost/").unwrap(),
            None
        ));
        assert!(is_shell_document(
            &Url::parse("https://tauri.localhost/x").unwrap(),
            None
        ));

        assert!(!is_shell_document(&app, None));
        assert!(!is_shell_document(
            &Url::parse("https://app.example.com/chat").unwrap(),
            None
        ));
        assert!(!is_shell_document(
            &Url::parse("https://other.example.com").unwrap(),
            None
        ));
        assert!(!is_shell_document(
            &Url::parse("javascript:alert(1)").unwrap(),
            None
        ));
        assert!(!is_shell_document(
            &Url::parse("file:///etc/passwd").unwrap(),
            None
        ));
    }

    #[test]
    fn configured_development_server_can_load_the_boot_page() {
        let dev_url = Url::parse("http://localhost:1430/index.html").unwrap();
        assert!(is_shell_document(&dev_url, Some(&dev_url)));
        assert!(is_shell_document(
            &Url::parse("http://localhost:1430/boot.js").unwrap(),
            Some(&dev_url)
        ));
        assert!(!is_shell_document(&dev_url, None));
        for candidate in [
            "http://localhost:1431/index.html",
            "http://127.0.0.1:1430/index.html",
            "https://localhost:1430/index.html",
            "http://user:password@localhost:1430/index.html",
            "http://localhost.example.com:1430/index.html",
        ] {
            assert!(!is_shell_document(
                &Url::parse(candidate).unwrap(),
                Some(&dev_url)
            ));
        }
    }

    #[test]
    fn update_message_names_the_announced_version() {
        assert_eq!(
            update_available_message("1.4.2"),
            "Version 1.4.2 is available. Install and restart?"
        );
    }

    #[test]
    fn update_channel_parses_only_known_names() {
        assert_eq!(UpdateChannel::parse("beta"), Some(UpdateChannel::Beta));
        assert_eq!(UpdateChannel::parse(" BETA "), Some(UpdateChannel::Beta));
        assert_eq!(UpdateChannel::parse("stable"), Some(UpdateChannel::Stable));
        for bad in ["", "canary", "nightly", "beta; rm -rf /"] {
            assert_eq!(UpdateChannel::parse(bad), None, "input {bad:?}");
        }
        assert_eq!(UpdateChannel::Beta.as_str(), "beta");
        assert_eq!(UpdateChannel::Stable.as_str(), "stable");
    }

    #[test]
    fn channels_supported_requires_the_placeholder() {
        let templated = vec![
            "https://releases.example.com/{{channel}}/{{target}}/{{current_version}}".to_string(),
        ];
        assert!(channels_supported(&templated));
        let plain = vec![
            "https://releases.example.com/{{target}}/{{arch}}/{{current_version}}".to_string(),
        ];
        assert!(!channels_supported(&plain));
        assert!(!channels_supported(&[]));
    }

    #[test]
    fn channel_endpoints_substitute_the_channel_name() {
        let templates = vec![
            "https://releases.example.com/{{channel}}/{{target}}/{{current_version}}".to_string(),
            "https://releases.example.com/shared/{{target}}".to_string(),
        ];
        assert_eq!(
            channel_endpoints(&templates, UpdateChannel::Beta),
            vec![
                "https://releases.example.com/beta/{{target}}/{{current_version}}".to_string(),
                "https://releases.example.com/shared/{{target}}".to_string(),
            ]
        );
        assert_eq!(
            channel_endpoints(&templates, UpdateChannel::Stable)[0],
            "https://releases.example.com/stable/{{target}}/{{current_version}}"
        );
    }

    #[test]
    fn env_value_overrides_the_persisted_channel() {
        assert_eq!(
            pick_channel(Some("beta"), UpdateChannel::Stable),
            UpdateChannel::Beta
        );
        assert_eq!(
            pick_channel(Some("stable"), UpdateChannel::Beta),
            UpdateChannel::Stable
        );
        // A garbage or blank env value keeps the persisted choice.
        for bad in ["nightly", "", "   "] {
            assert_eq!(
                pick_channel(Some(bad), UpdateChannel::Beta),
                UpdateChannel::Beta,
                "input {bad:?}"
            );
        }
        assert_eq!(pick_channel(None, UpdateChannel::Beta), UpdateChannel::Beta);
    }

    #[test]
    fn update_channel_persists_through_a_config_dir() {
        let dir = std::env::temp_dir().join(format!(
            "supastack-update-channel-{}-persist",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        // Missing file and missing directory both resolve to Stable.
        assert_eq!(load_update_channel(&dir), UpdateChannel::Stable);
        save_update_channel(&dir, UpdateChannel::Beta).expect("save must create the config dir");
        assert_eq!(load_update_channel(&dir), UpdateChannel::Beta);
        save_update_channel(&dir, UpdateChannel::Stable).unwrap();
        assert_eq!(load_update_channel(&dir), UpdateChannel::Stable);
        // A corrupt sidecar falls back to Stable instead of failing.
        std::fs::write(update_channel_path(&dir), "canary").unwrap();
        assert_eq!(load_update_channel(&dir), UpdateChannel::Stable);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
