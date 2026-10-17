# Tauri Desktop Shell + Sub-repo Sync — Design

> Spec for: `apps/desktop` (Tauri 2.0, Rust tray/hotkey shell over the web app) and
> `scripts/` one-command sync into three standalone private repos
> (`supastack-web`, `supastack-mobile`, `supastack-desktop`).

## Decisions (user-approved)

- **Desktop architecture:** Tauri webview loads the web app URL directly —
  the web app remains the single source of UI, auth (better-auth cookies,
  same origin), and AI chat (`/api/chat/*` SSE). No UI is forked or re-implemented.
- **Global hotkey:** `CmdOrCtrl+Shift+Space` toggles the window.
- **Sub-repo remotes:** derived from `origin`'s org (`<org>/supastack-{web,mobile,desktop}.git`),
  overridable via `SUBREPO_{WEB,MOBILE,DESKTOP}_REMOTE` env vars.

## Part 1 — `apps/desktop`

### Layout

```
apps/desktop/
  package.json            # @supastack/desktop — tauri CLI dev dep + scripts
  ui/index.html           # text-only startup page with backend retry
  placeholder-icon.png    # transparent native packaging placeholder
  src-tauri/
    Cargo.toml            # tauri 2.x, tauri-plugin-global-shortcut, -single-instance
    tauri.conf.json       # v2 schema; no static windows (created programmatically)
    build.rs              # tauri_build::build()
    src/main.rs           # thin entry → supastack_desktop_lib::run()
    src/lib.rs            # url resolution, window, tray, hotkey, close-to-tray
    capabilities/default.json
    placeholder-icons/    # transparent native resources (committed)
```

### Behavior

- `resolve_app_url()`: runtime env `SUPASTACK_APP_URL` → compile-time
  `option_env!("SUPASTACK_APP_URL")` → `http://localhost:3000`. Values that do not
  parse as absolute `http(s)` URLs fall back to the default. Implemented as a pure
  function `resolve_app_url_from(runtime, compiled)` + thin env wrapper so it is
  unit-testable (`cargo test`).
- Main window created in `setup()` via `WebviewWindowBuilder` +
  `WebviewUrl::External(url)`, title "Supastack", 1200×800.
- **Tray:** `TrayIconBuilder` with menu `Show Supastack` / `Quit`; left-click on
  the tray icon toggles visibility; the demo uses a transparent packaging placeholder.
- **Global shortcut:** `tauri-plugin-global-shortcut` registers the resolved
  accelerator — runtime env `SUPASTACK_DESKTOP_HOTKEY` → `CmdOrCtrl+Shift+Space`
  default (Tauri accelerator syntax). On press: hidden/minimized → show+focus,
  else hide.
- **Close-to-tray:** `CloseRequested` → `prevent_close()` + `hide()`; Quit menu
  item exits the process.
- **Single instance:** `tauri-plugin-single-instance`; a second launch shows and
  focuses the existing window instead.

### Workspace wiring

- `package.json` scripts: `dev` = `tauri dev`, `build` = `tauri build`,
  `typecheck` = `cargo check --manifest-path src-tauri/Cargo.toml`,
  `test` = `cargo test --manifest-path src-tauri/Cargo.toml`,
  `icons` = regenerate native resources from the transparent placeholder.
- Root `package.json`: `dev`/`build` gain `--filter=!@supastack/desktop` so the
  existing commands don't spawn a native window / Rust build; new
  `dev:desktop` (web + desktop via turbo) and `build:desktop`.
- turbo `typecheck` still includes desktop (`cargo check`; turbo caches it).
- Icons: `pnpm --filter @supastack/desktop icons` runs
  `tauri icon placeholder-icon.png -o src-tauri/placeholder-icons`.
  Products replace the transparent source with their own assets.
- `.env.example` += `SUPASTACK_APP_URL`, `SUBREPO_*_REMOTE` (commented).
- `tauri.conf.json` stays comment-free JSON (prettier `format:check` clean).

### Explicitly out of scope

Deep links / OAuth callback scheme (webview is same-origin, so social sign-in
works in-window), auto-updater, code signing, desktop CI workflow, offline mode.

## Part 2 — `scripts/` sub-repo sync

### Files

- `scripts/subrepos.json` — per-repo declaration: `name`, `app` dir,
  `remoteEnv`, `extraPaths` (e.g. web ships `Dockerfile`, `docker-compose.yml`).
- `scripts/subrepos.mjs` — pure, testable library:
  - `workspacePackageMap(root)` → name→dir for `packages/*` + `apps/*`.
  - `packageClosure(root, appDir)` → recursive `workspace:*` dep closure.
  - `deriveRemote(originUrl, name)` → same org/protocol; handles https + ssh.
  - `buildFileManifest(root, spec)` → source path list (app + closure + curated
    root files + extras), excluding `node_modules`, `dist`, `.next`, `.expo`,
    `.turbo`, `target`, `src-tauri/gen`, `coverage`.
  - `renderRootPackageJson(rootPkg, name)` → slim standalone root manifest
    (keeps turbo/vitest/eslint/prettier/typescript toolchain, drops
    changeset/playwright/smoke scripts).
- `scripts/sync-subrepos.mjs` — CLI:
  1. Resolve remote (`env[remoteEnv]` → derive from `origin`; missing → warn+skip).
  2. Ensure clone in `.subrepos/<name>` (gitignored): `git init` + remote +
     fetch + checkout default branch (creates `main` when remote is empty).
  3. Mirror: delete all files except `.git/`, copy manifest set, write
     `.supastack-sync` marker `{sha, repo, syncedAt}`.
  4. `git add -A`; clean → report up-to-date; else commit
     `chore: sync from supastack@<short-sha>` and `git push -u origin <branch>`.
  - Flags: `--only <web|mobile|desktop|full-name>`, `--dry-run`.
  - Warns when the monorepo working tree is dirty (sync uses worktree contents).
- `tests/subrepos.test.ts` — vitest on fixture workspaces in tmpdirs (closure,
  remote derivation, manifest exclusions, root-package rendering).
- Root `package.json` += `"sync:subrepos": "node scripts/sync-subrepos.mjs"`.
- `.gitignore` += `.subrepos/`.

### Standalone sub-repo contents

`apps/<x>` + dep-closure `packages/*` + verbatim `pnpm-workspace.yaml`,
`tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs`,
`.prettierignore`, `.gitignore`, `vitest.config.ts`, `turbo.json`, `AGENTS.md`,
plus generated slim `package.json` + `README.md` stub noting the repo is synced
read-only from the monorepo. `workspace:*` deps keep resolving inside the
sub-repo's own pnpm workspace. Sync is one-way (monorepo → sub-repo); sub-repo
history = one commit per sync, so pushes are incremental by construction.

## Part 3 — Docs

- `.ai/` mirrors for each new file (file-guardian), `PROJECT_CONTEXT.md` → Current Work.
- `AGENTS.md` — new boundaries: desktop is a webview shell (no forked product UI;
  tray/hotkey/single-instance in Rust; `SUPASTACK_APP_URL` selects the backend),
  sub-repos are sync targets (edit in the monorepo), plus new commands.

## Risks / notes

- First `cargo check` compiles all Tauri deps (minutes once, cached afterwards
  by cargo + turbo inputs).
- Magic-link/2FA emails still open in the system browser — same as web; the
  desktop window only owns in-app flows.
- Empty remote repos are handled by the init+first-push path.
