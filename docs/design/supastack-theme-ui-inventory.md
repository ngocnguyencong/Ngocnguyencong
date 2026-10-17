# Supastack theme / UI inventory

> Status: **split landed** (2026-09-11). This inventory mirrors the current tree. Ownership guide: [kit-product-theme.md](./kit-product-theme.md). Appearance axes: [ui-appearance.md](./ui-appearance.md).

## 1. Current theme system

| Layer             | Path                                  | Role                                                                                                                                                 |
| ----------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing brand   | `apps/web/app/theme.css`              | `.marketing-theme` only. Pure marketing locks **Obsidian** via `.marketing-theme:not(.app-theme)`. Product builders do **not** customize this file.  |
| Kit product theme | `apps/web/app/app-theme.css`          | Editable product chrome: structural tokens, component selectors, `html[data-density\|data-radius\|data-font]` remaps.                                |
| Color packs       | `apps/web/src/theme/catalog.ts`       | 16 packs → `themeStylesheet()` paints `html[data-theme]`. Default **Obsidian**.                                                                      |
| UI presets        | `apps/web/src/theme/presets.ts`       | Density / radius / font catalogs + `apply*` + FOUC boot fragment.                                                                                    |
| ThemePicker       | `apps/web/src/theme/theme-picker.tsx` | Settings → Appearance radiogroups for all four axes.                                                                                                 |
| Boot              | `apps/web/src/theme/theme-boot.ts`    | Server-only `THEME_BOOT_SCRIPT` (theme + presets) injected from root layout only.                                                                    |
| Layout wiring     | `apps/web/app/layout.tsx`             | Imports `globals.css`, `theme.css`, `app-theme.css`; injects stylesheet + boot.                                                                      |
| Legacy aliases    | `apps/web/app/globals.css`            | `:root` maps `--canvas`/`--ink`/… → pack tokens; layout chrome for older reference classes.                                                          |
| Package (dormant) | `packages/design-tokens`              | Still exports pale `referenceTokens`. Listed in `apps/web` transpilePackages; **not** the live web appearance source. Do not treat as product theme. |

No separate design-tokens CSS pipeline drives the kit UI. Live tokens are CSS variables from `catalog.ts` + `.app-theme` / marketing lock.

### Color packs (`THEME_CATALOG` — 16)

| id          | Name               | Scheme |
| ----------- | ------------------ | ------ |
| `obsidian`  | Obsidian (default) | dark   |
| `graphite`  | Graphite           | dark   |
| `midnight`  | Midnight           | dark   |
| `pine`      | Pine               | dark   |
| `wine`      | Wine               | dark   |
| `umber`     | Umber              | dark   |
| `paper`     | Paper              | light  |
| `slate`     | Slate              | dark   |
| `glacier`   | Glacier            | light  |
| `ink`       | Ink                | dark   |
| `blossom`   | Blossom            | light  |
| `harbor`    | Harbor             | dark   |
| `amethyst`  | Amethyst           | dark   |
| `volt`      | Volt               | dark   |
| `meadow`    | Meadow             | light  |
| `porcelain` | Porcelain          | light  |

Token names: `--page`, `--section`, `--raised`, `--text`, `--muted`, `--border`, `--border-strong`, `--btn`, `--btn-text`, `--accent`, `--content-text`, `--accent-hover`, `--accent-ink`.

### Presets (`presets.ts`)

| Axis          | Attr           | Default       | Options                               |
| ------------- | -------------- | ------------- | ------------------------------------- |
| Density       | `data-density` | `comfortable` | `comfortable`, `compact`              |
| Corner radius | `data-radius`  | `soft`        | `soft`, `sharp`, `round`              |
| Font pairing  | `data-font`    | `editorial`   | `editorial`, `geometric`, `monospace` |

Persistence: browser `localStorage` + cookie (`supastack-theme|density|radius|font`). Not an account / Better Auth field. FOUC boot restores all four axes before paint.

## 2. Surfaces: kit consumer vs marketing-only

### Marketing-only (brand lock — Obsidian)

Uses `.marketing-theme` **without** `.app-theme`, so color packs do not restyle the brand canvas.

| Surface                                             | Entry                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Homepage `/`                                        | `landing-page.tsx` → `HomeShell` + `marketing-theme` + kit blocks |
| Blog / Docs / resources                             | `resources/resource-shell.tsx` + `marketing-theme`                |
| Pricing (homepage section), contact, privacy, terms | Marketing pages under resource / home shells                      |

Default marketing and application chrome is text-only. Products supply their own artwork; no built-in logo assets ship in the demo.

### Kit / product UI (`.app-theme`, follows packs + presets)

| Surface                                                                                         | Entry / notes                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard / workspace shell                                                                     | `app-chrome.tsx` (`token-root app-theme`); ≤760px header exposes **Settings** + **Appearance**                                           |
| Auth `/auth`                                                                                    | `web-auth-page.tsx` → `MarketingAccountShell` (`marketing-theme app-theme`) — header chrome + **product pack** colors (no Obsidian lock) |
| Settings (Appearance ThemePicker + gallery, Security, Billing, Members, Notifications, General) | `web-settings-page.tsx`; ThemePicker on `appearance`                                                                                     |
| Billing, Chat, org settings, invite                                                             | Workspace / invite routes with `app-theme` (e.g. `invite/[token]/page.tsx`)                                                              |
| Reference / production reference shells                                                         | `reference-app.tsx`, `production-reference-app.tsx`                                                                                      |

Contract tests: `theme-ownership.contract.test.ts`, `auth-layout.contract.test.ts`, `app-chrome.contract.test.ts`, `application-theme` e2e, `contrast.test.ts`.

### Hybrid note

`MarketingAccountShell` = `marketing-theme` **and** `app-theme`. The `:not(.app-theme)` lock does **not** apply; auth inherits the selected product pack while keeping marketing header/footer chrome.

## 3. How product builders customize

1. **Pick at runtime** — Settings → Appearance → ThemePicker (color + density + radius + font). Narrow shells also reach Appearance from the workspace header. Syncs across app routes via `html[data-*]` + cookie/localStorage.
2. **Add a color pack** — append `ThemeDefinition` in `catalog.ts` with every `THEME_TOKEN_NAMES` entry; keep contrast contracts.
3. **Edit kit chrome** — change tokens / selectors in `app-theme.css` only; keep consuming `var(--page|--accent|--radius-*|…)`.
4. **Extend presets** — update `presets.ts` catalogs and matching `html[data-*]` rules in `app-theme.css`.
5. **Do not** edit marketing `theme.css` for product look, invent a second theme stylesheet, hardcode Obsidian hex into app chrome, or post theme choice to Better Auth.

## 4. Docs map

| Doc                                            | Purpose                                      |
| ---------------------------------------------- | -------------------------------------------- |
| This file                                      | Inventory of files, packs, presets, surfaces |
| [kit-product-theme.md](./kit-product-theme.md) | File ownership (marketing vs kit)            |
| [ui-appearance.md](./ui-appearance.md)         | Orthogonal axes + customization steps        |

## 5. Remaining gaps (non-blocking)

- `@supastack/design-tokens` / pale `referenceTokens` still exist but are not the live appearance path — document or retire later.
- Theme choice is per-browser only (no workspace/account sync).
- ~~Web mobile ThemePicker~~ — **closed**: ≤760px WorkspaceShell header exposes Settings + Appearance; ThemePicker + Kit UI gallery usable at ~375px on `/settings/appearance`. Expo `apps/mobile` still has no native pack picker.
