# Tauri Desktop Shell + Sub-repo Sync — Implementation Plan

**Goal:** `apps/desktop` Tauri 2.0 shell (webview → web app, Rust tray/hotkey) +
`scripts/` incremental sync into `supastack-{web,mobile,desktop}` private repos,
auto-synced on every push to `main`.

**Spec:** `docs/superpowers/specs/2026-09-20-tauri-desktop-subrepos-design.md`
**Stack:** Tauri 2.x/Rust, `tauri-plugin-global-shortcut`, `tauri-plugin-single-instance`, pnpm/turbo, Node ESM scripts, vitest.

---

### Task 1 — `apps/desktop` scaffold

**Files:**

- Create `apps/desktop/package.json` — `@supastack/desktop`, `@tauri-apps/cli` dev dep;
  scripts `dev`/`build`/`tauri`/`icons`/`typecheck`(cargo check)/`test`(cargo test).
- Create `apps/desktop/src-tauri/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json}`.
- Create `apps/desktop/src-tauri/src/{main.rs,lib.rs}`.
- Create `apps/desktop/ui/index.html` — text-only startup page with backend retry.
- `tauri.conf.json` v2: `identifier com.supastack.desktop`, `frontendDist: "../ui"`,
  empty `app.windows` (window created in Rust), bundle icons list. Pure JSON (no
  comments — prettier clean).

**Rust (`src/lib.rs`):**

- `resolve_app_url_from(runtime: Option<&str>, compiled: Option<&str>) -> String`
  — trim → parse absolute http(s) URL → fallback `http://localhost:3000`.
  `resolve_app_url()` wraps env/`option_env!`. Unit tests: empty env, invalid,
  custom, precedence order.
- `setup()`: single-instance plugin → create `main` window
  (`WebviewUrl::External`, 1200×800, title Supastack) → close-to-tray
  (`CloseRequested.prevent_close()` + `hide()`) → tray icon + menu
  (Show/Quit, left-click toggles) → `global_shortcut` plugin with handler,
  register resolved accelerator (`SUPASTACK_DESKTOP_HOTKEY` env →
  `CmdOrCtrl+Shift+Space`).
- `toggle_main_window(app)` helper shared by tray click/menu + hotkey.

**Verify:** `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`,
`cargo check`.

### Task 2 — Icons

- Use `apps/desktop/placeholder-icon.png`, a fully transparent source for required
  native packaging resources. Products supply their own artwork.
- `apps/desktop/package.json` `icons` script runs
  `tauri icon placeholder-icon.png -o src-tauri/placeholder-icons`.

### Task 3 — Workspace wiring

- Root `package.json`: `dev`/`build` += `--filter=!@supastack/desktop`;
  add `dev:desktop`, `build:desktop`, `sync:subrepos`, `prepare` (git hooksPath).
- `.env.example` += `SUPASTACK_APP_URL`, commented `SUBREPO_{WEB,MOBILE,DESKTOP}_REMOTE`.
- `.gitignore` += `.subrepos/`.

### Task 4 — Sync library + tests (TDD)

- `tests/subrepos.test.ts` (fixtures in `fs.mkdtemp`): `workspacePackageMap`,
  `packageClosure` (recursive `workspace:*` incl. devDeps), `deriveRemote`
  (https+ssh forms), `buildFileManifest` (exclusions: node_modules/dist/.next/
  .expo/.turbo/target/src-tauri/gen/coverage), `renderRootPackageJson`
  (strips changeset/playwright/smoke scripts, keeps toolchain), remoteEnv override.
- `scripts/subrepos.mjs` — implement to green.
- `scripts/subrepos.json` — three repo specs; web `extraPaths`:
  `Dockerfile`, `docker-compose.yml`.

### Task 5 — Sync CLI

- `scripts/sync-subrepos.mjs`: resolve remote (env → derive from `origin`),
  ensure clone under `.subrepos/<name>` (init+fetch+checkout default branch or
  `checkout -B main` for empty remotes), wipe-except-`.git` + copy manifest,
  write `.supastack-sync` marker, `git add -A` → clean ? skip : commit
  `chore: sync from supastack@<sha>` + `push -u`. Flags `--only`, `--dry-run`.
- Smoke-verify end-to-end against local bare repos (`file://` remotes in tmp).

### Task 6 — Auto-push

- `.github/workflows/subrepo-sync.yml`: on `push` to `main` + `workflow_dispatch`;
  checkout → `node scripts/sync-subrepos.mjs` with remotes derived from origin;
  auth via `SUBREPO_SYNC_TOKEN` secret (x-access-token URL rewrite) — falls back
  to `GITHUB_TOKEN` for same-repo-permission setups? No: document PAT secret as
  required. Concurrency guard `subrepo-sync`.
- `.githooks/pre-push` → `node scripts/sync-subrepos.mjs` (non-blocking warn);
  `prepare` script wires `core.hooksPath`.

### Task 7 — Docs + verify

- `.ai/` mirrors for every new file; `PROJECT_CONTEXT.md` Current Work;
  `AGENTS.md` desktop boundary + sync rules + commands.
- `pnpm check`, `cargo test`, dry-run smoke.
