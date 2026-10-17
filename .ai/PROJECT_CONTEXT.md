# Project Context

## 2026-10-16 integration pass: docs, agent maps, changelog

Docs: `feature-guides.ts` gained `modules/usage-controls` (Billing &
entitlements — owner/admin AI budget + per-meter caps, `USAGE_METERS`
registry) and `modules/appearance-sync` (Workspace features —
`user_appearance` bundle, `/api/account/appearance` +
`/api/mobile/appearance`, `updatedAt` last-writer-wins, boot paint stays
local). `reference-guides.ts` api-routes tables now list
`/api/account/appearance` (GET/PUT), `/api/mobile/appearance` (GET/PUT),
`/api/mobile/usage` (GET), `/api/workspace/export` (GET, owner/admin);
the env table documents `SUPASTACK_UPDATE_CHANNEL` and the `{{channel}}`
endpoint placeholder. All new strings translated in
`beginners.{de,es,fr}.json` (catch-all dicts) and the four route-purpose
strings in `reference.{de,es,fr}.json`; the modified updater-endpoint
string was rekeyed. `docs-navigation`/`docs-i18n`/`llms-txt` tests green;
`pnpm sync:subrepos --dry-run` confirmed the new files land in
supastack-web with no internal-only leaks.

`prompts/README.md` points builders at `/setup` as the first in-app
stop. `changelog-entries.ts` `2026-10-16` entry replaced with the
owner-authored 9-point text ("A ready-to-build kit…", workspace export +
desktop beta channel added). `AGENTS.md` carries bullets for appearance
sync, usage controls, `/setup`, mobile offline cache, `push.receipts`,
desktop `{{channel}}` channels, and the export route — none match
`INTERNAL_ONLY_LINE`, so they render into sub-repo AGENTS.md copies.

## 2026-10-16 WP7 desktop update channels + WP8 workspace data portability

Desktop (`apps/desktop`): `SUPASTACK_UPDATER_ENDPOINT` may carry an
optional `{{channel}}` placeholder (validated by
`check-release-config.mjs`; hostname placeholders still rejected as
non-public). `src-tauri/src/lib.rs` adds `UpdateChannel{Stable,Beta}` +
`channels_supported`/`channel_endpoints` helpers, persists the pick in
an `update-channel` sidecar under `app_config_dir()` (env
`SUPASTACK_UPDATE_CHANNEL` overrides per run, default/invalid →
Stable), and rebuilds the updater via
`updater_builder().endpoints(resolved Urls)` when a template supports
channels — plain endpoints keep the `app.updater()` path untouched. A
"Beta Updates" `CheckMenuItem` sits under "Check for Updates…", checked
when Beta, disabled without a channel template; toggling persists +
runs an interactive check behind the existing `UPDATE_CHECK_RUNNING`
guard. `docs/desktop-updates.md` documents feed publishing; roadmap
item shipped. `cargo test` 22/22, `cargo check` clean, release-config
tests 15/15.

Web (WP8): `src/workspace-export.ts` `buildWorkspaceExport(workspaceId,
now, db?)` — `format: "supastack.workspace-export"`, v1; every query
`eq(workspaceId)`-scoped, all select lists explicit (invitation tokens,
webhook secrets, delivery payloads, API-key hashes, audit
metadata/ipAddress, provider credentials, connected-account envelopes
never selected/queried); Date→ISO + bigint→string normalization;
bounds: 100 deliveries, 1000 credit transactions + audit events, 12
usage periods. `GET /api/workspace/export` — session →
`resolveActiveWorkspaceIdForSessionUser` + membership role → 401/403;
`exportDownloadLimiter` (10/min/IP fail-open) via `rateLimitResponse`;
audits `workspace.data_exported`; `no-store` + `workspace-export-<slug>
-<yyyy-mm-dd>.json` attachment. Settings → General shows the
`WorkspaceExportCard` (no-JS anchor) behind
`canExportWorkspaceData()` (fail-closed `requireWorkspaceManager`
wrapper in `workspace-access.ts`) with `settings.workspaceExport` copy
in all 4 locales. Roadmap item shipped.

## 2026-10-16 WP6 mobile offline reads + Expo push receipt reconciliation

Mobile: `src/offline/` — `createOfflineCache({storage})` (injectable
`OfflineStorage`; `fs-storage` writes JSON under
`<document>/supastack-offline/` via `expo-file-system@~57.0.7`, published
2026-09-11). Entries are `{savedAt,value}` envelopes under FNV-1a-hashed
file names keyed by `scope` = `${userId}:${workspaceId}` — 7-day TTL,
256 KB cap, corrupt files deleted on read. `cachedRead` falls back to
cache only on network errors (fetch `TypeError` / `MobileApiError`
status 0); 401/403/404 rethrow. Screens (home, content, commerce,
notifications, chat list, billing credits/usage) route reads through
`readCachedOrFetch` and render `<OfflineNotice savedAt>` on
`source === "cache"`. Provider exposes `offlineCache` + `offlineScope`
and calls `clearAll` on sign-out/account switch; workspace switches keep
other scopes. No offline mutation queueing.

Server: `push_ticket` table (id PK = Expo ticket id, token, nullable
`user_id` FK cascade, `created_at` index) — migration `0020_flat_nehzno`
applied to dev Postgres. `sendExpoPush` records `ok` tickets and prunes
immediate `DeviceNotRegistered` tokens; internal `userId` rides the
message shape, stripped before the Expo POST. `push-receipts.ts`
`reconcilePushReceipts` runs as the `push.receipts` platform job every
30 minutes (`*/30 * * * *`): 15-min-min-age tickets, ≤1000/run, ≤300-id
receipt chunks with the same Bearer auth as sends, prunes
`DeviceNotRegistered`, deletes answered tickets, sweeps >24h leftovers,
isolates chunk failures, never logs tokens. Roadmap: both items shipped.

Pre-WP6 fixes this session: StatGrid `.head` wraps so delta chips drop
under the label instead of overflowing; `.wrap` is a size container with
`data-count` container queries (6 → 2x3/3x2/6-up, 4 → 2x2/4-up, auto-fit
fallback); usage Save buttons are `button-primary`. Re-screenshotted
dashboard-390, dashboard-sunset-1440 (focused), usage-1440 in
`tmp/screens/`.

## 2026-10-16 WP4 rework + WP5 theme library expansion

Rework: `setup-readiness` now treats every non-`"production"` `APP_ENV`
(`local`/`development`/`test`) as dev for the APP_URL HTTPS/localhost rule
and the demo auth-secret branch — a fresh dev checkout no longer flags
them as "action". `usage-settings` formats dates and USD with the page
locale (`locale` prop threaded from `WebSettingsPage` → `UsageSettings`
and `SecuritySettings`; `supadata/web/forms` pins `"en-US"` like
`supadata/format`). Manage forms became single forms — label stacked above
a 12rem field, Save + named secondary submit (`reset=1`/`clear=1`; the
actions already gave those flags precedence). StatGrid min track
200px → `9.5rem` so six KPIs sit 6-up at 1440. TrendChart axis labels and
the hover dot moved to HTML overlays (`position:absolute`, viewBox
fractions) while the svg uses `preserveAspectRatio="none"` +
`vector-effect="non-scaling-stroke"` inside a fixed 220px `.plot`;
alternate x ticks hide ≤520px (~4 remain).

WP5: `THEME_CATALOG` += 5 packs — `ember`/`fjord` (dark), `citrus`/`mono`/
`sunset` (light) — every pair verified against `contrast.test.ts` (citrus
hover brightened once: dark ink needs ≥4.5 on both accent and hover).
`STYLE_CATALOG` += ember-forge, fjord-console, citrus-launch,
mono-brutalist, sunset-journal on existing preset ids. `ui-copy.ts`
paletteDescriptions extended for de/es/fr. Mobile picks them up through
`/api/mobile/appearance` (`mobile-palette.test` iterates the catalog).
Re-screenshotted dashboard/usage/setup + new-style appearance/dashboard
shots in `tmp/screens/`.

## 2026-10-16 analytics dashboard polish — WP4

Dashboard is now keyboard/no-JS friendly, responsive below 420px, and shows
period-over-period deltas. `site-nav.tsx` site picker uses the themed
`Select` (real `<select>` preserved inside a GET form + `<noscript>` submit
for no-JS); period controls are `<a href>` links with `aria-current="page"`
(24h/7d/30d/90d/12m — `resolveRange` already knew `12m`). Layout moved from
an inline `minmax(420px, 1fr)` grid into `supadata/web/dashboard.module.css`
with `minmax(min(100%, 420px), 1fr)`; `insights/page.tsx` uses the same
shared module and visitors-search/mentions inline styles were removed.
`StatItem.delta` (optional) renders a lucide trend chip
(`ArrowUpRight`/`ArrowDownRight`/`Minus`, `good|bad|flat` tones,
visually-hidden "vs previous period"); `overview/page.tsx` computes the
previous equal-length range via `previousRange`/`percentChange` helpers in
`supadata/format.ts` and passes deltas for all six KPIs (bounce rate
`goodWhen:"down"`). Page header adds h1 "Overview" + site domain + a
reduced-motion-gated live pill (`N online` → `/dashboard/live?site=…`,
`realtime()` query). Empty state uses `EmptyState` ("Add your first site" +
3-step list + `CreateSiteForm`); `frame.tsx` sign-in error reuses
`EmptyState` instead of the ad-hoc auth-card. New `app/dashboard/loading.tsx`
(Skeleton stat/chart/panel shapes). `trend-chart.tsx` metric toggles got
arrow/Home/End keyboard navigation + a visually-hidden data table;
`breakdown.tsx` values carry `title` for truncated paths.
`setup-readiness-runtime.ts` `countAdminUsers` now uses
`select role, count(*) group by role` + `isAdminRole` summing instead of
loading every user row. Browser-verified at 1440/390px (dashboard, empty
state, /setup, /settings/usage — no horizontal overflow); screenshots in
`tmp/screens/`.

## 2026-10-16 navbar account-button anti-flicker

`SiteHeader` split into an async server wrapper (`site-header.tsx` →
`getViewerSnapshot()` in `viewer-snapshot.ts`, server-only + React `cache`,
`getAuthSession(await headers())`, throw→`undefined`) rendering the moved
`SiteHeaderClient` (`site-header-client.tsx`, new `viewer?: ViewerSnapshot`
prop; type in `viewer-snapshot-types.ts`). Marketing nav links are plain
`<a>` full loads, so the browser session cache was empty on every render
and the Dashboard/Get-started action popped in after hydration; SSR markup
now carries the right button, and the live session still wins once it
resolves. Both `noscript` blocks key off the snapshot when known.
`MarketingAccountShell` renders `SiteHeaderClient` directly — the auth
pages are client components that cannot mount an async server component.
Marketing + auth-shell + adjacent suites, typecheck, scoped
eslint/prettier pass. Local only.

## 2026-10-16 `/setup` — in-app readiness checklist — WP3

`/setup` (dev-open, production admin-only via `getAdminSession`/`notFound`,
`force-dynamic`, `robots:{index:false}` + robots.txt disallow + absent from
sitemap/llms.txt) renders `evaluateSetupReadiness` — a pure evaluator over
a reduced `SetupSnapshot` (booleans/kinds/lengths only, never secrets)
built by `setup-readiness-runtime.ts` (`collectSetupSnapshot`: config,
`select 1` probe, pending migrations, workspace/admin counts, code
constants). Checks group into foundation/accounts/providers/product/
platforms with `ready|action|demo|optional` statuses; action sorts first;
`readyForProduction` requires no actions and no demos in
foundation/accounts/email/billing. `packages/db` grew
`listPendingMigrations` (journal tags vs `drizzle.__drizzle_migrations`;
missing table = all pending, other errors propagate → "Could not read
migration state") backed by the embedded `migration-journal.ts`. UI is
token-only (`setup-page.module.css`), lucide status icons, `role="meter"`
progress, client `SetupCopyButton` progressive enhancement, anonymous-dev
plain shell vs `WorkspaceShell` chrome. Admin nav links it; `pnpm setup`
next-steps print the URL. Also fixed a server-action boundary: WP2's
sync parsers moved from `"use server"` `usage-actions.ts` to
`usage-input.ts` (Next forbids non-async exports in action modules).

## 2026-10-16 workspace usage controls (Settings → Usage) — WP2

Workspace owners/admins can now cap AI spend and metered usage; every
member reads the overview. New `workspace_usage_cap` table (PK
`(workspace_id, key)`, `cap int >= 0`; migration 0019, applied locally) +
`createDrizzleUsageCapRepository` (`list`/`get`/`set`/`clear`). Caps layer
over plan `usageLimits`: `usage-quota.ts` resolves the effective limit as
`min(planLimit, cap)` via a new injectable `caps` dep, a CAP-bound
rejection returns `quota_exhausted` without touching prepaid credits
(hard ceiling), while a plan-bound rejection keeps the existing
credit-overflow path; `getQuota` now reports `{used, limit, planLimit,
cap}` (`limit` stays the effective value). `ai-task-runtime` switched to
`resolveEffectiveUsageLimit` so an owner cap engages `ai.requests` even
with no plan limit. The committed/held AI-spend read is shared:
`packages/db/src/ai-spend.ts` `readAiSpendForPeriod` serves both the
budget-enforcement transaction (repositories.ts) and the overview — no
duplicated SQL. `usage-meters.ts` catalogs `ai.requests` plus any
plan-declared `usageLimits` keys; `usage-overview.ts` assembles
`{period, ai{budgetMicrounits string|null, isDefaultBudget, committed,
held}, meters[], credits{balance}}` (bigints as decimal strings; BYOK →
null budget). Server actions `usage-actions.ts` (owner/admin gate via
`canManageWorkspaceMembers`) upsert `workspace_ai_policy.
monthly_budget_microunits` (strict dollar input, `reset=1` → NULL) and
set/clear caps, audit `workspace.ai_budget_updated` /
`workspace.usage_cap_updated`, redirect `?status=budget-saved|cap-saved|
cap-cleared|forbidden|invalid`. New `usage` settings section (registry
after `billing`, 4-locale copy, both settings routes load
`loadUsagePanelData`) renders `usage-settings.tsx` — spend card with
`role="meter"` bar (warning >=80% / danger >=100%), per-meter rows with
cap forms, prepaid-credits link; `/billing` links to it. Mobile:
`GET /api/mobile/usage` + `src/usage/client.ts` (strict validation) +
read-only "Usage & limits" card on the billing screen. Verification: db
19/19, web 102/102 across the new/changed suites, mobile 16/16, tsc
clean web/db/mobile/i18n, eslint+prettier clean. Uncommitted — no
push/deploy/subrepo sync.

## 2026-10-15 cross-device appearance (theme) sync — WP1

A signed-in user's appearance now follows them across browsers, the desktop
webview shell, and mobile. New `user_appearance` table (user_id PK → user
cascade, `preferences` jsonb; migration 0018, applied locally) +
`createDrizzleUserAppearanceRepository` (user-scoped — this data follows the
account, not the workspace). Shared `src/theme/appearance.ts` owns the strict
`AppearancePreferences` contract (style/theme/density/radius/font/layout/
toastStyle), DOM snapshot read/apply through the existing `apply*` persisters
(localStorage + cookies stay boot-authoritative), the
`supastack-appearance-updated-at` stamp, and the change/applied window events.
Server `src/appearance-sync.ts` re-validates stored JSON (stale catalog ids →
null prefs, stamp kept). Routes: `/api/account/appearance` GET/PUT (401 /
same-origin 403 / 400 invalidPreferences / no-store) and the mobile BFF
`/api/mobile/appearance` (packs pre-mapped via `theme/mobile-palette.ts`;
PUT `{theme}` merges onto stored prefs or the DEFAULT_STYLE_ID bundle).
`AppearanceSync` mounts in `WorkspaceShell` only — marketing never calls the
API; server-newer applies, local-newer pushes, change events debounce ~800ms
into PUTs, all failures silent/offline-gated. ThemePicker + marketing
ThemeMenu stamp `markAppearanceChanged()` on user picks; a `syncNote` line in
all four ui-copy dictionaries renders under Settings → Appearance. Mobile:
`ThemeMode` += `"synced"`, `src/theme/synced.ts` client + SecureStore
`supastack.theme.synced` cold-start cache (strict `^#[0-9a-f]{6}$`i
validation, malformed packs dropped), provider exposes
`syncedPacks`/`syncedThemeId`/optimistic `selectSyncedTheme` (reverts on PUT
failure), appearance screen gained the "Match web app" mode + "Color pack"
radio card. Verification: db 6/6, web 27/27 new (theme dir 85/85), mobile
12/12, tsc clean for web/mobile/db, eslint+prettier clean. Uncommitted — no
push/deploy/subrepo sync.

## 2026-10-13 task-recovery helper + admin nav polish

`src/ai-task-recovery.ts` `taskRecoveryHref(query, consolePath = "/ai")`
extracts the duplicated `?taskId`/`?submissionKey` forward used by `/`,
`/{locale}/dashboard`, and `/dashboard` (supadata working tree); the
`/en/ai` canonical redirect now preserves those params instead of dropping
the query. New unit suite `src/ai-task-recovery.test.ts`; route-level
coverage extended in `src/locale-app-routes.test.ts` (left uncommitted —
mixed with foreign hunks). Admin users + organizations sub-navs gained the
Feature flags / Announcements links for symmetry. Orphaned
`#production-task` anchor removed; the e2e spec locates the task grid via
`.task-grid`. `app/dashboard/page.tsx` uses the helper but stays
uncommitted foreign work.

## 2026-10-13 changelog entry for the day's shipped work

New `2026-10-13` entry in `apps/web/src/marketing/changelog-entries.ts` (7 points, `MarketingChangelogEntry` shape) covering the day: dedicated `/ai` console route in every app language, 'AI task' nav link + `/dashboard` + task-recovery/budget-notification routing fixes, localized settings pages loading developer tools/audit log/active sessions, dead `/admin/orders` link removed, and the mobile/desktop catch-up batch (schedule pause/resume, chat rename/delete, webhook history, profile-name editing, expiring API keys, full content-entry editing; native Edit menu, persistent window zoom). Focused `changelog-entries.test.ts` green (6/6). Local only; no push/subrepo publication.

## 2026-10-13 admin nav dead link fix

Removed the dead `/admin/orders` link from the four platform-admin sub-pages (users, organizations, flags, announcements) — the route does not exist, so the link 404'd. Platform-level orders are not a kit concept; workspace orders live under `/commerce`. New `app/admin/admin-nav.test.ts` statically scans every `app/admin/**/page.tsx` and asserts each `href="/admin…"` resolves to a route directory with a `page.tsx`. Test-first: red on the four links, green after removal.

## 2026-10-13 mobile web navigation

Shared ShellNavigation drawer now scrolls independently, retains a sticky close control, uses safe-area padding and 44px navigation/footer actions, and expands nested workspace/account menus in flow. Mobile main-header actions wrap. Open-state resets on desktop resize, preventing automatic reopening on return to mobile. Local verification: 17 focused unit tests, 2 Chromium fixtures across all four layouts at 320/390/760px plus short landscape, desktop/no-JS, web typecheck/scoped lint/format. Session/workspace API reads mocked; no provider mutations. No commit/push/deploy or subrepo publication performed.

## 2026-10-13 navbar account-state cache
Local update: account actions wait for session resolution and retain confirmed state through background refetch/remount. No-JS actions preserved. Generic marketing action resolves to Get started or localized Return to dashboard. Shared-session and header tests plus public-page suite pass (26 tests). No commit, push, deployment or production mutation performed.


## Current Work (2026-10-12 mobile + desktop feature pass)

- Implemented locally (subagent-driven, all uncommitted): five parallel
  feature tasks closing documented mobile/desktop gaps.
- Push-tap deep links: `apps/mobile/src/push/deep-links.ts` (pure —
  extract/validate `data.href`, `WEB_HREF_TO_MOBILE_ROUTE` rewrites
  `/billing`→`/settings/billing`, `/dashboard`→`/home`, pass-through
  otherwise); `expo.ts` `startNotificationRouteListener` (live taps +
  cold-start drain via sync `getLastNotificationResponse`, dedupe on
  `request.identifier`); provider buffers pre-sign-in taps and flushes
  on session resolve. 17 new tests; mobile suite 122/122 green.
- `EXPO_ACCESS_TOKEN`: optional server-only env →
  `serverConfig.expo.accessToken` → `Authorization: Bearer` on Expo
  sends (`accessToken` dep wins over env; never logged; absent from
  public config). push.md known-limit bullet removed.
- Mobile data export: `security/client.ts` gained optional `api` param +
  `exportAccountData()` (`/api/account/export` via `MobileApiClient`);
  security screen "Your data" card → RN `Share.share` JSON.
- Mobile content + commerce: `/api/mobile/content{,/[entryId]}` and
  `/api/mobile/commerce/{products,orders}{,/[id]}` thin routes over the
  existing `*-actions` (workspace scoping + audit intact); mobile
  `src/content`/`src/commerce` clients + `/content` `/commerce` screens
  (hidden-tab `href: null` in `_layout.tsx`, home quick-action links);
  `reference-guides.ts` api-routes rows + de/es/fr translations.
- Desktop update path + launch-at-login: `tauri-plugin-{updater,process,
  dialog,autostart}` registered; `check_for_updates(interactive)` —
  `plugins.updater` sentinel `{"endpoints": [], "pubkey": ""}` ships in
  `tauri.conf.json` (pubkey is a mandatory field — absent config would
  abort startup); "Check for Updates…" + "Launch at Login"
  `CheckMenuItem`; background check spawned in setup.
  `check-release-config.mjs` validates `SUPASTACK_UPDATER_ENDPOINT`/
  `SUPASTACK_UPDATER_PUBKEY` and emits the `--config` overlay;
  `docs/desktop-updates.md` + llms.txt link + desktop extraPath.
- Roadmap page: mobile content/commerce, data export, and desktop
  auto-update added as shipped; "Desktop distribution polish" →
  in_progress; "Mobile receipt reconciliation" planned. 2026-10-13:
  six more `planned` future items added — passkey/biometric sign-in,
  mobile offline reads, desktop update channels, localized application
  UI, workspace data portability, usage-based billing reporting (27
  items); "Desktop distribution polish" description narrowed to
  signing/notarization + release automation.
- Verification: two-stage spec+quality reviews per task all pass;
  mobile 122/122, web route tests 20/20, config 62/62, cargo check+test
  13/13, desktop-release-config 13/13. All changes local — nothing
  committed or pushed.

## Current Work (2026-10-11 supadata analytics product + auth/landing overhaul)

- Full analytics + revenue-attribution product module built on the kit,
  all local/uncommitted:
- `packages/db/src/schema.ts` += 13 `sd_*` tables (site, site_key,
  visitor, session, event, payment, goal, funnel, alert, alert_event,
  integration, mention, keyword) — migrated; `sd_` prefix avoids the
  platform `analytics_event` collision.
- `apps/web/src/supadata/` domain layer: id/ua/geo/channels/api/auth/
  ingest/queries/payments/actions/format/load/seed/mcp-tools +
  web/ UI components (site-nav, trend-chart, breakdown, frame,
  live-view, forms). Tracker at `public/sd.js`.
- Ingest: `/api/e` (beacon) + `/api/v1/collect`; reads: `/api/v1/
  analytics/*` (overview, timeseries, realtime, dimension breakdowns,
  insights, funnel-results), visitors(+journey), payments, goals,
  funnels, sites, alerts, mentions, keywords, integrations, identify,
  webhooks/{provider}. `sd_*` site keys (hashed) pin sites; `sk_*`
  workspace keys/sessions scope reads via `resolveApiContext`.
- Dashboard: `/dashboard` + live/visitors/journey/insights/goals/
  funnels/alerts/mentions/settings on WorkspaceShell; public
  `/share/[shareId]` read-only dashboard (`noindex` metadata, NOT in
  robots disallow so the directive is visible).
- MCP parity: `createSupadataTools()` registers 17 tools on `/api/mcp`
  (site-scoped via ToolContext.workspaceId; `record_payment` write-
  scoped). Verified with a test `sk_` key: list_sites, overview,
  realtime, breakdown all return live data.
- Landing rebuilt on minimal marketing grammar: HeroProduct renders a
  REAL ProductFrame (KPI StatGrid + interactive TrendChart + top-pages
  bars) fed by `src/landing-preview.ts` (share slug "demo"; returns
  null safely when absent). StepsRuled → FeatureStory (real channel-
  revenue / realtime / funnel vignettes) → PricingPanel → FaqSplit.
  Boilerplate honesty kept: lede discloses supastack + sample data.
- AUTH FIX: `rate-limit-route.ts` `withTrustedClientHeader` used
  `new Request(request, {headers})` — Next 16 hands routes a
  `bound NextRequest` and the spec constructor reads the source's
  private `#state` → every `/api/auth/*` 500'd. Rebuilt from public
  fields (url/method/headers/signal/body+duplex). Verified: OTP send,
  OTP sign-in (code via `/mail-preview` local outbox), get-session,
  authed /dashboard all green.
- Google sign-in wired: `AUTH_GOOGLE_ENABLED=true` + placeholder
  GOOGLE_CLIENT_ID/SECRET in `apps/web/.env.local` — button renders
  enabled, `/api/auth/sign-in/social` returns a proper PKCE Google
  URL. Real credentials still needed for the actual OAuth round-trip.
- Small fixes along the way: geo lowercased/decoded at the boundary,
  UA `_`→`.` version normalization (iOS "17_5"→"iOS 17"), breakdown
  GROUP BY includes site_id, mrrSeries nested-aggregate rewrite,
  raw-sql Date params → ISO strings.
- Seed: `src/supadata/seed.ts` → 520 visitors / ~8k events / $4.5k
  revenue over 90 days + a few fresh live events for realtime.
- Tests: `src/supadata/supadata.test.ts` (13 unit tests, green);
  landing-page.test.tsx passes (boilerplate-disclosure wording kept).
- Developer surfaces: `packages/supadata-cli` (`sd`, zero-dep REST
  client) + `packages/supadata-sdk` (`<SupadataScript>` +
  `SupadataClient`) + 17 supadata tools on the kit MCP registry.
- Docs surface: `/api/v1` analytics routes + `/api/e` + `/api/v1/collect`
  listed in `resources/reference-guides.ts` (docs-navigation test).
- Verified: lint, web/db/i18n typecheck, unit tests (2456+), prettier,
  ai-docs, docs-navigation all pass on this module's scope.
- Open: real Google OAuth creds; alert delivery + mention/keyword
  ingestion are API-accepting but not yet scheduled.

## Current Work (2026-10-12 push-token surface review fixes)

- Review fixes on the Expo push surface only (locally, uncommitted):
- `mobile-push-tokens.ts` `resolveWorkspace` now uses the membership-
  verified `resolveMobileWorkspaceContext` (like every other mobile BFF)
  — a forged/stale `supastack.activeWorkspaceId` cookie can no longer
  stamp token rows onto a foreign or removed workspace (404
  `noWorkspace` on register).
- `mobile-push-tokens-bff.ts` split `resolveContext` → `resolveSession`:
  all three ops need the session (resolved once per request), but only
  `register` resolves the workspace — `list`/`unregister` are
  `session.user.id`-scoped, so workspace-less accounts can read/delete
  their own tokens instead of 404ing.
- `organization-actions.ts` exports `resolveActiveWorkspaceIdForSessionUser`
  (cookie → preference, no session re-resolve);
  `mobile-workspace-context.ts` uses it — one `getAuthSession` per
  request, the membership join remains the authorization.
- `packages/db/src/push-tokens.ts` — `register` prunes the caller's
  oldest `lastSeenAt` rows past `MAX_PUSH_TOKENS_PER_USER` (20, excluding
  the upserted token); `listForUser`/`listForWorkspace` bound at
  `PUSH_TOKEN_LIST_LIMIT` (500); `normalizeToken` stores the trimmed
  value.
- `apps/web/src/push.ts` — environment resolves via
  `serverConfig.app.environment` (NODE_ENV=production preprocessing
  applies); a failed chunk lands in `failed` + logs through
  `serverObservability.logger` (lazily imported, injectable) instead of
  abandoning remaining chunks; results gained `failed`.
- Mobile: `unregisterPushNotifications`/`push.unregister()` return
  `boolean` (false when the server DELETE failed); the notifications
  settings toggle only flips to disabled on success — a failed DELETE
  keeps it enabled + error text.
- `.ai/apps/web/src/push.md` gained a Known limits section (receipt
  polling, EXPO_ACCESS_TOKEN, tap deep-links, fan-out batching,
  involuntary-session unregister — all intentionally skipped).
- Out of scope but related: `mobile-feature-board.ts` still resolves its
  workspace through raw `resolveActiveWorkspaceIdForUser` (no membership
  join) — same class of issue, left untouched per the push-token scope.

## Current Work (2026-10-12 review hardening pass)

- Credits review fixes (spec+quality reviews found): `uq_credit_transaction_reference`
  partial unique index on `(workspace_id, kind, reference_id)` where
  `reference_id IS NOT NULL` + `credit_balance_nonnegative` CHECK —
  migration 0016. `isCreditReferenceConflict` maps 23505 → idempotent
  result: `grantWorkspaceCredits` returns `granted:false`; `consumeQuota`
  treats a raced same-reference debit as already paid (`ok:true`).
  `hasTransactionWithReference` gained an optional `kind` filter.
- `billing-bff` fires `onEntitlementActivated` on `"duplicate"`
  dispositions too — a post-commit hook failure on first delivery would
  otherwise dedupe forever and silently lose paid credits (hook's own
  reference dedupe makes replays safe). `billing-runtime` rejects
  `creditGrant > MAX_CREDIT_AMOUNT`.
- `POST /api/admin/credits`: +same-origin guard, strict digit-only amount
  parsing, audit write isolated in its own try (a failed audit no longer
  reports a committed grant as failed → double-granting retry).
- `GET /api/workspace/credits` + `GET /api/mobile/credits` no longer
  project `referenceId` (grant refs embed provider subscription ids).
  Web `CreditLedgerRow` + mobile `toTransaction` now validate rows
  (non-empty id/kind, parseable date) instead of tolerant fallbacks.
- Tests: usage-quota += raced-twin debit → `ok:true` + no-reference
  conflict propagates; billing-bff += duplicate-disposition refire;
  workspace-credits route asserts referenceId/actorUserId stay
  server-side. All green locally.
- Push hardening pass: `POST /api/mobile/push-tokens` register resolves
  the workspace via `resolveMobileWorkspaceContext` (membership-verified —
  a forged active-workspace cookie now 404s); list/unregister are
  user-scoped without the workspace gate; session resolves once per
  request via `resolveActiveWorkspaceIdForSessionUser`; per-user cap
  `MAX_PUSH_TOKENS_PER_USER=20` prunes oldest `lastSeenAt` on register;
  `listFor*` bounded at 500; Expo chunk POSTs isolate failures into
  `result.failed`; mobile unregister returns `false` on server failure so
  the settings switch only flips on success. Known limits documented in
  `.ai/apps/web/src/push.md`: no `getReceipts` polling job, no
  `EXPO_ACCESS_TOKEN`, no notification-tap deep links.
- Analytics hardening pass: consent withdrawal calls PostHog
  `opt_out_capturing`+`reset` and removes the Plausible script node;
  "Analytics preferences" affordance in the site footer + account shell
  re-opens the now-localized consent banner (en/de/es/fr); the beacon
  sends only the referrer's host; visitor hashing is keyed HMAC-SHA256;
  control characters rejected in optional fields; `localStorage` access is
  wrapped; fetch fallback uses `credentials:"omit"`. Skipped per scope:
  analytics_event retention job, CSP nonce.
- Public-pages locale pass: `resource-copy.ts` holds per-locale (en/de/
  es/fr) chrome copy for `/changelog` `/roadmap` `/api-reference`;
  `[locale]` routes get localized `generateMetadata` + `pageSocialMetadata`
  + `LocaleHtmlLang`; roadmap now lists push/credits/analytics/public
  pages/`pnpm setup`/feature-tabs as `shipped`; sections carry anchor ids;
  breadcrumbs + feedback CTA are locale-aware.
- Known latent issue (pre-existing, out of scope):
  `mobile-feature-board.ts` resolves its workspace via
  `resolveActiveWorkspaceIdForUser` without the membership join — same
  class as the push-token fix, flagged for a future pass.

## Current Work (2026-10-11 analytics consent hardening)

- Implemented locally: review fixes across the marketing analytics
  feature (consent withdrawal, privacy, robustness).
- Consent withdrawal: `AnalyticsScriptClient` tears down injected vendor
  scripts when consent leaves `accepted` (effect cleanup — PostHog
  `opt_out_capturing`+`reset`+global delete, Plausible script removal +
  global delete, `injectedRef` reset for clean re-inject).
  `use-consent-choice.ts` gained `writeConsentChoice` (single storage
  writer, `null` = undecided) with try/catch + in-tab memory fallback for
  blocked storage; `ConsentBanner` uses it and a new quiet
  `ConsentPreferencesButton` in the footer `.footerBar` clears the
  choice to re-open the banner.
- Privacy/robustness: beacon sends only `document.referrer` host
  (malformed → omitted); fetch fallback uses `credentials:"omit"`;
  `hashVisitorIdentity` is now `createHmac("sha256", secret)` over
  `JSON.stringify([ip, ua, date])`; collect fields reject control
  characters (`\x00`-`\x1F`,`\x7F`); `ANALYTICS_HOST` strips trailing
  slashes; db `optionalBounded` trims; banner copy localized via new
  `copyForLocale().consent` (en/de/es/fr) with `locale` passed from
  `SiteFooter`/`MarketingAccountShell`.
- Verification: web 58 + db 8 + config 53 focused vitest cases green,
  including three new jsdom suites (beacon gating/reactivity, banner +
  preferences, script-client teardown); web typecheck shows only the
  pre-existing unrelated credits error. All changes local — nothing
  committed or pushed.

## Current Work (2026-10-11 prepaid workspace credits)

- Implemented locally: prepaid workspace credits — a consumable balance
  (`credit_balance` + append-only `credit_transaction` ledger, migration
  0015 schema) separate from the per-period `usage_counter` quota.
- `packages/db/src/credits.ts` — `createDrizzleCreditsRepository`:
  `appendTransaction` applies a signed delta + appends the ledger row with
  `balanceAfter` inside ONE transaction; negative deltas use a guarded
  `UPDATE ... WHERE balance + amount >= 0` (row-lock re-check; concurrent
  debits serialize) and throw `InsufficientCreditsError` writing nothing.
  `listTransactions` (newest-first, ≤500), `getBalance` (0 when no row),
  `hasTransactionWithReference` for reference-keyed idempotency. Exported
  from the barrel; `AUDIT_ACTIONS.adminCreditsGranted` + label added.
- `apps/web/src/credits.ts` (server-only) — `getWorkspaceCredits`,
  `listWorkspaceCreditTransactions`, `grantWorkspaceCredits` (idempotent
  when `referenceId` supplied → `granted:false` on replay),
  `debitWorkspaceCredits` (positive amount stored negated).
- Quota overflow: `consumeQuota` gained `credits` dep + `referenceId`
  input — a CONFIGURED `quota_exhausted` debits `n` credits (kind `debit`,
  reason "usage quota overflow") and reports `ok`; `InsufficientCreditsError`
  restores the rejection; unlimited/unconfigured meters never reach the
  ledger. Wired in `ai-task-runtime` via `AI_TASK_QUOTA_KEY="ai.requests"` —
  dormant until a plan configures `usageLimits` (kit plans ship none).
- `ai-task-bff` gained an optional `consumeTaskQuota` dep inside the
  new-submission gate (replays/resumes skip it → a stored task is charged
  once); denied → 429 `quotaExceeded`, which `api-v1-runtime` maps like
  `rateLimited`.
- Plan grants: `ProductPlan.creditGrant?`; `billing-bff` fires a new
  `onEntitlementActivated` hook on processed active/trialing writes;
  `billing-runtime` grants via `grantWorkspaceCredits` with referenceId
  `plan-credit:<provider>:<subscriptionId ?? eventId>` — one grant per
  subscription across webhook replays.
- APIs/UI: `GET /api/workspace/credits` + `GET /api/mobile/credits`
  (`{balance, transactions}` latest 50); `POST /api/admin/credits`
  (admin-only, form+JSON, workspace existence check, audit write);
  admin organizations page gained a per-org "Grant credits" form;
  `/billing` gained a localized `WorkspaceCreditsCard` (`billing.credits`
  dictionary in en/de/es/fr); mobile billing screen gained a credits card
  via `src/credits/client.ts`.
- Verification: db credits contract suite (11 cases) + full db/web/mobile
  vitest green; db + mobile typechecks clean; web typecheck reports only
  pre-existing errors in unrelated in-flight files (analytics fixtures,
  `feature-tabs` block missing its `blockReferences` entry → resources
  suites fail at import — untouched). Mirror docs added/updated for every
  file. All changes local — nothing committed or pushed.

## Current Work (2026-10-10 configurable marketing analytics provider)

- Implemented locally: `ANALYTICS_PROVIDER` selects the marketing
  analytics adapter — `off` (default) | `local` | `plausible` | `posthog`.
  `ANALYTICS_SITE_ID` is required for the script providers via the
  existing `superRefine` pattern; `ANALYTICS_HOST` is an optional
  https-only vendor-origin override (`packages/config`,
  `providers.analytics`; public config exposes only the provider enum).
- `packages/db/src/analytics-events.ts` — `AnalyticsEventRepository`
  (`record` + `summarizeSiteTraffic`) over the existing `analytics_event`
  table; `apps/web/src/analytics.ts` (server-only) resolves the provider,
  validates the collect body, derives the trusted client IP via the new
  `clientIpForRequest` helper, and folds ip+ua+AUTH_SECRET+UTC-date into
  a daily-rotating sha256 `visitorHash` — raw IP/user-agent are never
  persisted.
- `POST /api/analytics/collect` 404s for non-local providers (mode never
  revealed), rate-limits through `analyticsCollectLimiter` (600/min,
  fail-open telemetry bucket), validates ≤2 KB JSON, returns 204.
- Consent wiring: `clientCaptureEnabledFor` replaces the compile-time
  `MARKETING_CLIENT_CAPTURE_ENABLED`; `useMarketingConsentChoice`
  (`useSyncExternalStore` over a same-tab `CONSENT_CHANGED_EVENT` +
  cross-tab `storage`) drives `ConsentBanner` (now takes a
  `clientCaptureEnabled` prop), `AnalyticsBeacon` (sendBeacon/keepalive
  pageviews + `trackEvent`), and `AnalyticsScriptClient` (Plausible defer
  script / PostHog official loader snippet — no new dependency). All
  mount via `MarketingAnalytics` inside `SiteFooter` only; the account
  shell keeps the banner so `/auth`-first sessions still get the choice.
- `app/admin/page.tsx` gains a "Site analytics" card (30-day pageviews,
  distinct-visitor uniques, events, top-10 paths) rendered only for real
  admins under the `local` provider.
- Verification: focused vitest green (config 60, web marketing+analytics
  33 + account-shell/landing/public-pages/app-chrome), config typecheck
  clean. Web typecheck reports only pre-existing in-flight errors
  (billing-runtime/credits/billing-bff.test) and
  marketing-sitemap/public-routes-dynamic stay blocked by the unrelated
  `feature-tabs` blockReferences miss. All changes local — nothing
  committed or pushed.

## Current Work (2026-10-10 public changelog/roadmap/API reference)

- Implemented locally: three indexable buyer-facing marketing pages —
  `/changelog`, `/roadmap`, `/api-reference` — each with an unprefixed
  English route plus a `[locale]` route (validates `isAppLocale`, `en`
  redirects to unprefixed, non-English renders in the localized
  `ResourceShell`). All six route files are `force-dynamic` with
  canonical + `pageLanguageAlternates(path)` hreflang + `BreadcrumbList`
  JSON-LD. The three `[locale]` routes additionally compose
  `pageSocialMetadata({ locale })` with `images: [rootOgImage]` (og:locale/
  og:url overrides); the three unprefixed routes set no page-level
  `openGraph`/`twitter` and inherit the root layout's card.
- `src/marketing/resource-copy.ts` — `RESOURCE_COPY: Record<AppLocale, …>`
  localizes the pages' chrome (h1/title/description, intro, badge, status
  labels, auth heading/body, access labels, CTA, `home` breadcrumb) for
  en/de/es/fr. Deliberate scope: entry/item/endpoint bodies stay English
  data. `{placeholder}` templates split inline links/code at render time.
  `ChangelogPage`/`RoadmapPage`/`ApiReferencePage` take `locale: AppLocale`;
  `formatChangelogDate` gained the same param; `*PageMeta` derives English
  strings from `RESOURCE_COPY.en`.
- `src/marketing/changelog-entries.ts` — curated `MarketingChangelogEntry[]`
  (date/title/points, newest-first, unique dates) reconstructed from
  shipped repo history; rendered through the `changelog-timeline` kit
  block by `changelog-page.tsx`. (Type renamed from `ChangelogEntry` —
  it collided with the kit block's differently-shaped export.)
- `src/marketing/roadmap-items.ts` — curated `RoadmapItem[]`
  (title/description/status) grouped shipped → in_progress → planned by
  `groupRoadmapItems`; closes with a `localePath(locale, "/feedback")`
  CTA. Static data only — the page never queries `feature_request` rows.
  Review fix: push notifications moved to `shipped`; shipped items added
  for feature-tabs, public trust pages, `pnpm setup`, prepaid credits,
  and site analytics.
- `src/marketing/api-reference.ts` — `apiReferenceGroups()` derives
  tag-grouped endpoint rows (method badge, path, summary, `auth` kind:
  `"session-or-key"` | `"public"` mapped to labels via `RESOURCE_COPY`)
  straight from `openApiDocument.paths` (nullish path items and
  present-but-empty operations guarded), so the page can't drift from
  the registry; `api-reference-page.tsx` adds a beginner-readable
  session/`sk_`-Bearer auth explainer and links `/api/v1/openapi`.
  `anchorFor` dedupes colliding tag slugs; deep-link `id`s moved to the
  `<section>` wrappers so `.home section[id]` scroll-margin clears the
  fixed header.
- `ResourceShell` now mounts `LocaleHtmlLang`, so `<html lang>` syncs to
  the rendered locale post-hydration on every localized resource page.
- SEO/nav wiring: `marketingStaticPaths` + `STATIC_ENTRY_META`
  (changelog weekly/0.7, roadmap + api-reference monthly/0.5),
  `STATIC_PAGE_INFO` (llms.txt Pages), `siteConfig.resourceLinks`
  (footer "Resources" group + 3 `MarketingSection` members),
  `reference-guides.ts` api-routes section links `/api-reference`
  (de/es/fr snapshots updated, 300 keys each). `seo.tsx` gained
  `pageLanguageAlternates(path)`; `homeLanguageAlternates()` delegates.
- Verification: focused vitest green — `public-pages.test.tsx` (24:
  English + localized-chrome renders, anchor dedupe, unprefixed-route
  `x-supastack-locale: de` redirect destinations, locale-route
  redirect/notFound/`generateMetadata → {}`/og-locale cases),
  entries/items/api-reference data guards, marketing-sitemap, and
  `public-routes-dynamic` — 61 tests; prettier clean; web typecheck 0
  errors. All changes local — nothing committed or pushed.

## Current Work (2026-10-10 Expo push notifications)

- Implemented locally: end-to-end Expo push notifications for the mobile
  app on the existing `device_push_token` table (migration 0015).
- `packages/db/src/push-tokens.ts` — `createDrizzlePushTokenRepository`:
  token-keyed upsert `register` (re-points the row at the registering
  user/workspace), caller-scoped `unregister`, user/workspace/user-list
  reads, and `removeTokens` pruning. Exported from the package barrel.
- `apps/web/src/push.ts` (server-only) — `sendExpoPush` (≤100-message
  chunks to the Expo push API, injectable fetch, ticket↔token receipts),
  `sendUserPush`/`sendWorkspacePush` (repository resolution +
  `DeviceNotRegistered` pruning). Only `ExponentPushToken[...]` reaches
  the network except under `APP_ENV` local/test dev tokens.
- `/api/mobile/push-tokens` — `GET`/`POST`/`DELETE` behind a
  deps-injected `createMobilePushTokensBff` + server-only drizzle
  wiring, mirroring the feature-board BFF split.
- `notification-emit.ts` gained a best-effort `sendPush` dep wired in
  `notification-runtime.ts` → `sendUserPush`, so every in-app
  notification also pushes to the recipient's devices.
- Mobile: `src/push/{register,client,expo}` — pure injected decision
  logic + `/api/mobile/push-tokens` client + expo-notifications/
  constants/SecureStore glue. `MobileAppProvider` registers once the
  session has an active workspace and unregisters on sign-out (the
  settings sign-out button unregisters first, while the cookie is still
  valid); Settings → Notifications gained the device push toggle.
  `app.json` gained the `expo-notifications` plugin; all failure paths
  (permission denied, simulator/Expo Go, missing projectId, offline)
  resolve silently.
- Verification: 39 focused vitest cases (db repository, web sender, BFF,
  route, emit fan-out, mobile decision logic), db + mobile typechecks,
  scoped eslint/prettier pass. Web typecheck reports only pre-existing
  errors in unrelated in-flight files. All changes local — nothing
  committed or pushed.

## Current Work (2026-10-10 guided setup CLI)

- `pnpm setup` (`scripts/setup.mjs`, Node built-ins only): interactive
  guided-setup wizard for a fresh checkout — preflight (Node engines floor,
  Corepack probe, packageManager pin, node_modules → offers
  `corepack pnpm install`), env bootstrap delegated to `setupEnvironment`,
  optional `@supastack/db db:migrate` (default no, Postgres-first
  remediation), then the dev command + docs pointers. `--check`/`--dry-run`
  validate tools + env without writes; `--yes`/non-TTY stdin take safe
  defaults (env bootstrap only). Child commands are fixed-literal
  `corepack pnpm …` spawns (joined string + shell on Windows).
- Exports `parseFlags`/`resolveMode`/`satisfiesNodeRange`/`normalizeAnswer`/
  `runWizard` (injected io) — `tests/setup.test.ts` covers parsing, wizard
  flows, and spawned CLI runs on fixture checkouts (20 cases).
- Wiring: root `package.json` `setup` script; the web platform manifest
  ships `scripts/setup.mjs` and gains a `setup` script override so
  `pnpm setup` exists in that checkout (env bootstrap needs `apps/web`,
  so the pair stays web-only); generated platform llms.txt links the wizard;
  root `llms.txt`, README guided-option paragraph, and a one-paragraph note
  in `docs/agent-setup.md` point at it (agents keep the deterministic
  phases).
- Live-verified in this checkout: `node scripts/setup.mjs --check` and
  `corepack pnpm setup -- --check` both report preflight PASS lines and the
  deliberately absent `apps/web/.env.local` without writing. All changes
  local — nothing committed or pushed.

## Current Work (2026-10-10 feature-tabs block + landing-v2 preview)

- New marketing kit block `feature-tabs`: client-component interactive
  feature tour (tab rail → horizontal strip on narrow) of
  `{ id, label, title, description, points, icon?, media? }` items.
  WAI-ARIA tabs (roving tabindex, `aria-selected`/`aria-controls`/
  `aria-labelledby`, all arrows + Home/End, automatic activation);
  every panel stays in the DOM — inactive panels hide only under
  `(scripting: enabled)` and the 180ms `--motion-enter` swap entrance is
  `no-preference`-gated (scroll-reveal fail-open contract). `media`
  defaults to a `ProductFrame` placeholder; the registry entry ships
  product-frame's files like `hero-product` does. `icon` takes a
  `LucideIcon` or a node (server callers pass elements — component refs
  can't cross the RSC boundary).
- Registered in `src/kit/blocks.ts` (+ contract coverage in
  `blocks.test.ts`); `/kit-blocks` gained a neutral three-tab demo.
- New dev-only route `app/landing-v2/page.tsx` (same `NODE_ENV` →
  `notFound()` gate as `/kit-blocks`, `/landing-v2` disallowed in
  `robots.ts`, no locale mirror): alternate landing composition —
  `HeroSplit` + `FeatureTabs` + `FeatureRows` instead of the default
  `HeroCentered` + `FeatureGrid`; pricing/FAQ/CTA reuse `siteConfig.faq`
  and the same illustrative tiers. Guarded by
  `src/landing-v2-route.test.ts`. The default landing (`app/page.tsx`,
  `src/landing-page.tsx`) and the theme are untouched.
- Mirror docs: new `feature-tabs(.module)`, `landing-v2/page`,
  `landing-v2-route.test` mirrors; updated `kit/blocks(.test)`,
  `app/kit-blocks/page`, `app/robots` mirrors. All changes local —
  nothing committed or pushed.

## Current Work (2026-10-09 marketing surface modernization)

- Auth chrome: `MarketingAccountShell` no longer renders `SiteFooter` — sign-in
  keeps header + card only; `ConsentBanner` stays mounted so consent still
  prompts on `/auth`-first sessions.
- New marketing block `scroll-end-cta`: once-per-session native `<dialog>`
  opened by page-bottom scroll (requires `scrollY > 0`) or a 90s visible-time
  dwell fallback; shares one guarded check (other-dialog/form-focus deferral),
  full dialog a11y (Escape/backdrop/X, Tab trap, scroll lock/restore,
  reduced-motion exit), and a `preview` inline mode for `/kit-blocks`.
  Mounted on the landing page with neutral demo copy; registered with a
  public component guide and 8-case test.
- Footer controls: `SiteFooter` gained `locale` + a `.footerBar` row hosting
  the new `ThemeMenu` (`src/theme/theme-menu.tsx` — LanguageSwitcher-style
  popover applying packs via `runThemeTransition`/`applyTheme`, label synced
  by MutationObserver) and `LanguageSwitcher`; `ResourceShell` forwards
  `locale`. Chrome `site-footer` block gained the matching `controls` slot.
- Motion: `hero-centered`/`hero-split` gained the hero-product CSS-only load
  entrance grammar; landing below-fold sections (features/pricing/FAQ/CTA)
  now wrap in `ScrollReveal`.
- Verification: 30 focused vitest cases + repo ai-docs/demo-content guards +
  web typecheck + scoped eslint/prettier all pass. Browser verification not
  run this session.
- All changes local — nothing committed or pushed.

## Current Work (2026-10-09 CI repair)

- Fixed the three failing CI jobs on the latest `main` push (run 37945807137):
  1. `security-scan`: an early-October commit-hash refresh invalidated every
     `.gitleaksignore` fingerprint (commit prefixes changed); the scan reported
     10 findings, all verified placeholders (`StrongEnough123` test password,
     `test-secret-…` fixture, empty `OPENAI_API_KEY=`, docs prose,
     `sk_REPLACE_WITH_YOUR_KEY` guides/translations). Re-baselined with the
     eight current-history fingerprints — exact-fingerprint policy kept, no
     allowlists.
  2. `validate` `pnpm build`: turbo's strict env sandbox was stripping the
     job-level `APP_ENV=test`, so `next build`'s `NODE_ENV=production` mapped to
     `APP_ENV=production` (config preprocess) and page-data collection demanded
     the production secret set. Added `APP_ENV` to `globalEnv` in `turbo.json`
     (hashed, since it changes build output). Reproduced the ZodError locally
     without the entry and built `@supastack/web` cleanly with it.
  3. `windows-fresh-setup`: `tests/demo-content.test.ts` web manifest scan hit
     the 5s vitest default on the Windows runner (5,042ms). Manifests are now
     memoized per repo across both `it.each` assertions (6 walks → 3) and each
     test gets a 30s timeout.
- Mirror docs updated: `.ai/turbo.md` (new — turbo.json ships downstream),
  `.ai/.gitleaksignore.md`, `.ai/tests/demo-content.test.md`. No workflow-file
  changes were needed; nothing committed or pushed.

## Current Work (2026-10-08 agent-readiness audit)

- Read-only audit of the agent context stack: `llms.txt` (all relative link
  targets exist), the security-protocol anchors (`webhooks.ts` SSRF guard +
  `x-webhook-signature`, `request-body.ts` byte caps, `api-key-auth.ts` hashed
  `sk_` keys, scheduler-tick `x-scheduler-key` timing-safe check, MCP 401/405),
  the runbook ↔ prompt contract, `prompts/README.md` ↔ shipped prompts, and
  `.ai/` mirror coverage all verified. Guard tests green: 7 llms-txt + 3
  ai-docs + 66 subrepos = 76 passed.
- Two small drift fixes in `llms.txt`: the preamble no longer claims
  `openssl rand` recipes live in `docs/agent-setup.md` (they moved to
  `scripts/setup-env.mjs` + format docs), and `docs/aws-ses.md` joined the
  Guides section (the only shipped doc the map omitted). Mirror updated. No
  commits.

## Current Work (2026-10-07 publication)

- Owner authorizes committing all completed Supastack work and pushing to main.
  Preserve newer remote changes, verify the integrated tree, and keep provider
  secrets and temporary artifacts out of the commit. Deployment is not requested.
- Integrated the completed work with the current remote main. Lint, 18
  non-desktop typechecks, 2,202 tests, and formatting pass; 35 database/provider
  cases remain gated. All 18 non-desktop production builds pass using the local
  environment and fake/local providers. The 17 UI browser acceptance cases pass.
- Repaired setup-reference/Compose-default drift, workspace scheduler fixtures,
  and repeated platform-manifest test scans. Resolved new dependency advisories
  with patched versions and a narrow legacy parser override; the existing audit
  policy passes with its three verified local backports, without new exceptions.
- The authorized main push triggers the configured platform-mirroring workflow.
  Disable the duplicate local hook with SUBREPO_SYNC_SKIP; leave remote syncing
  intact. Deployment is not requested. Live container/VPS/provider acceptance and
  native Rust checks remain unverified on this host.

## Current Work (2026-10-07 agent setup acceptance)

- Implemented locally: agent setup/prompt repairs, Postgres → migrate → app
  sequencing, loopback Compose port defaults, configurable local/prod database
  and storage credentials, and a Coolify private-network one-shot migrator.
- `scripts/setup-env.mjs` uses only Node built-ins. It creates missing env files,
  preserves valid secrets/config, rejects conflicts/invalid keys/symlink paths,
  retains CRLF/comments, and offers a no-write `--check`. Twelve fixture tests
  cover these contracts; no operator env files were modified.
- `docs/agent-security.md` is the shared auth/RLS/logging acceptance checklist
  linked by root and generated platform maps. The public site index has explicit
  security links. Keep BFF workspace authorization distinct from Supabase Data
  API RLS; privileged database access cannot prove isolation. Health probes DB
  connectivity, not live providers; direct console sinks need separate review.
- Observability wording is corrected in English and de/es/fr. Mirrors remain
  scoped to this repo; the security checklist ships on every platform, while
  backend setup scripts/runbooks ship with web only.
- Verification: 110 focused tests, scoped lint, web typecheck, formatting,
  Compose config parsing, and Bash/PowerShell snippet syntax. Final export gate
  is rerun after documentation review. Docker Desktop is installed but its
  engine is unavailable; live Docker/Podman, Coolify/VPS and real auth/provider
  acceptance remain unverified. The checks use fake/local providers and do
  not modify operator secrets.

## Current Work (2026-10-06 UI foundation)

- Implemented locally: 21 packs, 17 curated styles, four responsive shell layouts,
  and 43 copyable blocks. Ocean/Lavender/Cobalt/Sand are additive; black
  `obsidian-studio` remains the default. Shared structural tokens reach body
  overlays; native adapters retain native controls/navigation and semantic roles.
- Select/Popover/Dialog/Sheet/Tabs/Disclosure now serve chrome, docs search,
  and forms. Compact drawers retain destinations, workspace/account access,
  and focused-mode navigation; the collapsible rail preference is browser-local.
  Controlled master/detail, toolbar, and pagination have localized working
  previews in Appearance and `/kit-blocks`, plus public component guides.
- Motion uses 120ms feedback, 180ms entrance, 120ms exit, 220/160ms disclosure,
  interruptible overlays, persistent errors, and toast exit/stack movement.
  Preserve homepage entrance/theme reveal and reduced-motion static cues.
  Native pressed fills preserve text contrast.
- Focused behavioral/contrast tests pass. Browser checks cover 1440/390/320px,
  reduced motion, 200% CSS zoom, no-JavaScript reading/navigation, and app/auth
  typography. Final `pnpm check:local` passes: lint, 18 non-desktop typechecks,
  2,164 tests (35 gated skips), and formatting. All 17 browser cases pass,
  including rendered selected-navigation contrast in every pack and both
  gallery state/master-detail flows. Accent text is separated from action fills
  and adjusted only when contrast requires it. Windows acceptance used the pinned
  Corepack toolchain through a temporary external PATH shim. Authenticated data
  flows, native rendering, screen readers, and device animation performance
  remain unverified. No commit, push, deploy, or synchronization.

## Current Work (2026-10-06)

- Agent-readability initiative complete locally (uncommitted): the kit now
  ships a layered agent context stack — repo-root `llms.txt` map +
  `docs/agent-setup.md` unattended runbook + `prompts/agent-setup.md`
  pasteable driver + `docker-compose.dev.yml` containerized dev env +
  per-sub-repo generated `llms.txt` + product-level `/llms.txt` route.
- `llms.txt` (root): llmstxt.org format — H1, blockquote, headingless
  "Important notes" preamble (server-only secrets, `workspaceId`, consent
  boundary, fail-twice-then-report), sections Start here / Agent setup &
  deploy / Security protocols (18 entries with verified code anchors —
  incl. outbound-webhook SSRF guard, bounded request intake, exact-match
  trustedOrigins) / Guides / Agent prompts / Architecture map / Testing /
  Optional.
  `tests/llms-txt.test.ts` fails on any dead relative link target.
- `docs/agent-setup.md` (~540 lines): agent contract → Phase 0 preflight +
  decision table → env bootstrap (both `.env` + `apps/web/.env.local`,
  `openssl rand` recipes, verified `packages/config` formats) → Docker path
  → Podman path (socket/`podman-compose`/`:z`/rootless) → universal deploy
  sequence → Coolify checklist (delegates to `docs/vps-coolify.md`) →
  plain-VPS Docker (docker install, `app` profile, Caddy+ufw, cron tick;
  documents the Docker-ports-bypass-ufw footgun with the `!override` fix)
  → 11 security protocols → copy-paste verification block →
  failure-domain troubleshooting table. Env precedence verified in
  `@next/env`/`loadEnvFile` source: compose `environment:` beats mounted
  `.env` files. Docker daemon absent on this machine — compose verified by
  inspection only.
- `docker-compose.dev.yml`: postgres (internal-only, no host port) + `dev`
  (node:22-bookworm-slim, repo bind mount, pnpm-store volume, port 3000)
  + profiled one-shot `migrate`. `apps/docs` setup site gained an "AI agent
  setup path" block.
- Sub-repo sync: `renderLlmsTxt(spec, files)` in `scripts/subrepos.mjs`
  generates a per-repo `llms.txt` (GENERATED set; links gated on shipped
  manifest ∪ GENERATED — always-on Security protocols section);
  `mirror()` writes it after README; `renderReadme` points agents at it;
  `subrepos.json` `extraPaths` now ships curated `docs/*.md` to all three
  repos and `prompts/` + `docker-compose.dev.yml` + the full doc set to
  web. `tests/subrepos.test.ts` (59+ tests) green.
- `/llms.txt` agent index (local): new `app/llms.txt/route.ts` (`GET`,
  `force-dynamic`, `text/plain; charset=utf-8`) serves `buildLlmsTxt()` from
  `src/marketing/llms-txt.ts` — H1/blockquote from `siteConfig`, `## Docs`
  lists every guide grouped by `DOC_GROUPS`, `## Pages` maps
  `marketingStaticPaths` through the typed `STATIC_PAGE_INFO` (typecheck
  fails on a missing entry), `## Blog` lists posts, `## Reference` links
  `/status`, `/api/health`, `/api/v1/openapi`, `/api/mcp`. Links are
  absolute on `siteOrigin()` resolved per request (APP_URL contract); the
  proxy matcher skips dotted paths so no locale redirect applies.
  `public-routes-dynamic.test.ts` now pins `app/llms.txt/route.ts` too.
  Verified live: `GET /llms.txt` on the running dev server returns 200
  text/plain with all 165 guides enumerated. Web typecheck reports only
  pre-existing `src/kit/blocks.test.ts` errors from unrelated in-flight
  work. No commits.
- Two-stage review round (spec + quality, fresh-eyes subagents) applied:
  `MOBILE_ALLOWED_ORIGINS` added to `.env.example` (production-required per
  `packages/config` superRefine; feeds auth `trustedOrigins`); VPS
  migrations run in a throwaway `node:22-bookworm-slim` container
  (`--network host` + published 5432) since fresh VPSs lack Node; Phase-4
  env tables split into the 7 config-enforced boot vars vs
  required-for-feature; Phase-1 checkpoint greps for empty+placeholder
  secrets; `run -T` for headless compose. Quality round: sales-fulfillment
  tail removed from `docs/github-auth-setup.md` (buyer-clean boundary);
  `docs/agent-setup.md` unshipped from mobile/desktop manifests;
  `supabase-doctor.mjs`/`supabase-provision.mjs` + their script entries
  ship to web only; `check:local`/`typecheck:local` added to KEEP_SCRIPTS;
  `upgrading.md` upstream remote placeholder-ized; generated `llms.txt`
  gates the doctor command + wiki link on the manifest; `mirror()` renders
  from the post-husk file list. New guard tests in
  `tests/subrepos.test.ts` pin shipped-command consistency
  (`KNOWN_UNSHIPPED_COMMANDS` — bidirectional), Han-free shipped mirrors
  (`KNOWN_HAN_MIRRORS` — 75 pre-existing allowlisted, TODO translate),
  manifest membership for `scripts/*.mjs` refs, and link annotation.
- Third verification round: a 16-agent read-only audit swarm covered every
  requirement (root/sub-repo `llms.txt`, runbook executability, security
  claims vs code, prompt ↔ runbook drift, env inventory, Coolify v4 docs,
  compose/Dockerfile spec-conformance, mirror accuracy, buyer-clean scan,
  changelog). Result: 15/16 clean — the one critical finding was
  `apps/web/src/resources/additional-guides.ts` `web/upgrading` in-app copy
  still hardcoding the private maintainer org's monorepo URL and a fixed
  upstream remote name in English + de/es/fr translation JSONs (the .md
  doc was already placeholder-ized; the product copy wasn't). Fixed in this
  pass: the guide now uses the generic `upstream` remote with a
  `https://github.com/<org>/supastack-web.git` placeholder and
  "repository you forked or purchased" phrasing across English + de/es/fr
  copies, merchant-side vocabulary was purged from
  `apps/web/src/resources/**` (commerce-boundary, agent-memory, EAS and
  product-grid strings reworded), and `tests/ai-docs.test.ts` gained the
  private-org banned terms plus a shipped-resources scan guarding the
  regression. Also systemic:
  `.ai/PROJECT_CONTEXT.md` ships to all three repos via force-include and
  carried internal provenance (org/branch names) past `INTERNAL_ONLY_LINE` —
  fixed by a stricter mirror-only `INTERNAL_PROVENANCE_LINE` transit regex +
  a shipped-.ai scan guard. Other landed polish: bounded health-poll, ufw
  `!override` extended to web's 3000 (Docker-published ports bypass ufw —
  Caddy proxies loopback), wget-in-image Coolify healthcheck caveat, env
  inventory gaps (`NODE_ENV`, `SCHEDULER_TICK_URL`, missing Stripe price
  ids), `PROVIDERS_*`→`*_PROVIDER` naming fix in deployment.md, Dockerfile
  `USER node` hardening, Windows reserved-name `.gitignore` block. Docker
  live-smoke remains the only unverifiable item (no Docker on this host).

## Current Work (2026-10-05)

- App foundation blocks (local): controlled master/detail, table-toolbar, and
  pagination blocks use token-only CSS. A shared localized preview exercises
  filtering, selection, page bounds, state variants, and overlays on Settings
  → Appearance and the dev-only `/kit-blocks` route. The blocks own
  presentation and callbacks only; callers own data, URL, and workspace state.

- Theme/token foundation implemented (local; final validation above): shared motion and semantic status
  tokens, root-level structural CSS defaults, stronger measured contrast
  coverage, and four additive light packs/style bundles. Preserve
  `obsidian-studio`, existing public token APIs, and the intentionally black
  default. The root theme integration consumes `motionTokens`,
  `--elevation-overlay`, `--font-sans`, `--control-border`, and `--focus-ring`;
  the shell integration owns the `collapsible` layout implementation. Tests
  are added before behavior changes. No commit, push, or deploy.

- Windows beta repairs (local): reproduced the sync conflict-restore test's
  LF/CRLF failure with isolated global Git configuration. Temporary fixture
  repositories now pin their checkout policy; conflict recovery covers both
  LF and CRLF and all 48 sync tests pass under `autocrlf=true`/`eol=crlf`.
  The local mail singleton also lost queued deliveries after module reload;
  a failing regression now passes with a process-global symbol slot. All 37
  focused email/composition/auth-schema tests pass. An actual Next route bundle
  sent a fictional message that the separate mail-preview bundle rendered;
  temporary instrumentation was removed. The final full suite passes 2,093
  cases with 35 gated skips under the isolated Windows Git config. Lint,
  formatting, 18 non-desktop typechecks, 18 builds, and both browser suites
  (34 local + 15 production-interface cases) pass. This machine lacks the
  documented Web `.env.local`; the default build
  rejects missing production config. Build acceptance used temporary
  `APP_ENV=local`, fake/local providers, and `--env-mode=loose`. A temporary
  Corepack shim also avoids the ambient pnpm 11.6 versus pinned 11.19 mismatch.
  Existing account issuer schema and migration are present; live PostgreSQL
  signup remains unverified because the Docker daemon is unavailable. Do not
  claim the default complete
  `verify:local` command passed. The user now authorizes committing and pushing
  all current changes on `codex/security-hardening`, including the earlier
  auth/security and theme repairs. Keep the existing verification limits in
  the handoff; synchronize targets or deploy only on a separate request.

## Current Work (2026-10-04)

- Theme-default repair complete locally: `DEFAULT_STYLE_ID` now drives all six
  server-rendered and pre-paint defaults; marketing inherits the selected style.
  Explicit saved visitor choices and optional locked/pinned modes are preserved.
  Five regressions failed before implementation. A real one-line switch to
  `minimal-product` repainted desktop/mobile homepage and auth plus no-JavaScript
  rendering; restored `obsidian-studio` afterward. All six focused browser tests
  pass, covering saved choices, theme controls, app chrome and narrow screens.
  Both web typechecks pass. Also corrected React props typing in the existing
  chrome test and removed stale logo assertions from the browser suite. Theme
  guides, prompt and mirrors document the one-line workflow. Work stays local.

- Marketing button refinement complete locally: removed the hover underline
  from shared CTA buttons, including the header and mobile menu. Desktop normal
  and reduced motion plus the 390px menu show no underline and retain the 2px
  keyboard focus outline. Formatting and scoped diff checks passed. No commit
  or push for this refinement.

## Current Work (2026-10-04)

- Theme-default repair complete locally: `DEFAULT_STYLE_ID` drives all six
  server-rendered and pre-paint defaults; marketing inherits the chosen style.
  A real one-line `minimal-product` switch passed desktop/mobile homepage, auth
  and no-JavaScript checks; restored `obsidian-studio`. Valid saved preferences
  still win. Six browser tests and the web typecheck pass. The focused suite
  passes 66 cases, including startup/storage and corrected chrome contracts.
  Code, guide, prompt and mirror changes remain uncommitted and unpushed.

- Demo cleanup publication verified: neutral demo copy, text-only default chrome,
  removed customer proof, transparent native icon placeholders, updated agent
  boundaries, and the Windows startup-origin repair are committed and pushed.
  All three GitHub branch histories were rewritten with explicit SHA leases in
  one atomic push; 135 original artwork objects are absent from every local ref.
  Unrelated working changes remain local. Verification on the isolated main
  update: repository lint and formatting passed; all 19 typecheck tasks passed;
  1,881 JavaScript cases passed before replacing one obsolete artwork assertion,
  then all seven updated chrome contracts and all nine demo/memory cases passed.
  All 12 Rust tests and native Windows startup/retry checks passed.
  GitHub still retains seven closed pull-request refs (#4 through #10); #10's
  old tree contains the original artwork. Those refs are read-only and cannot
  be erased by a normal branch history rewrite. Do not claim a server-wide purge.

- Publishing in progress: the user authorized committing and pushing the demo
  cleanup and rewritten history. Stage only neutral demo content, associated
  mirrors, asset removal/placeholders, and the desktop startup-origin fix.
  Keep unrelated working changes local. Prepare an isolated update based on
  the latest main branch, preserving its existing changes. Validate the actual
  committed tree, then publish with explicit expected-SHA leases.

- Logo removal and Windows startup fix complete locally. Web/app/email chrome,
  desktop splash, and social previews contain no built-in artwork. Original
  assets, generators, preservation guidance, and metadata logo URLs are gone;
  native packaging uses fully transparent icon placeholders. User-authorized
  history rewrite changed 50 local refs, including diff snapshots: 135 artwork
  blobs are unreachable and deleted after reflog expiry/GC. Original artwork
  paths and descriptions are absent from history; linked worktree is clean.
  Working changes are preserved. Nothing pushed; remote history is unchanged.
  Windows blank-window cause: guard rejected the exact Tauri dev-server origin.
  Regression failed before the fix; all 12 Rust tests now pass. Native WebView2
  checks verify dev and bundled startup, unreachable-backend UI, and Retry
  recovery into the running demo, with no logo or page script errors.
  Final source-blob audit found no embedded logo artwork. Checks: 77 focused
  JavaScript tests, web/email typechecks, scoped lint/formatting, and eight
  browser cases across 1440/390/320px, locales, docs, auth, and no-JavaScript.

- Boilerplate demo content cleanup completed locally: the landing hero,
  tagline, feature/FAQ presentation, and homepage metadata use neutral sample
  content. Customer quote modules, five portrait assets, localized trust labels,
  setup estimates, and the empty video frame are removed. AGENTS.md and
  PRODUCT.md enforce this boundary, and stale memory guidance is removed.
  Regression tests cover rendered pages in all locales and pure platform
  manifests/instruction renders; policy wording survives the export filter.
  Verification: 170 focused tests passed (one database-gated skip), web/i18n
  typechecks, scoped lint/formatting, and browser checks at 1440/390/320px with
  reduced motion and no-JavaScript reading. Fresh hydrated browser context had
  no page or console errors. Desktop shares this web page; a native desktop
  build was not run. No commits, synchronization, pushes, or deployment.

- Account security hardening (local): session settings rows and revoke forms
  carry opaque session IDs; the account action resolves the requested ID only
  among the current request user's Better Auth sessions and keeps the matching
  bearer token server-side for revocation. Account deletion now checks sole
  organization ownership and deletes personal workspaces/user inside one
  transaction. It acquires shared `workspace-seats:<id>` locks in sorted order
  between `FOR NO KEY UPDATE` and `FOR UPDATE`, rereads memberships and owner
  counts, and rolls back/retries up to three times if a new workspace appeared
  outside the initial inventory. A best-effort post-commit audit uses a null
  actor because the user has been deleted. Focused action regressions pass.
  The native Better Auth
  `/api/auth/list-sessions` endpoint still returns the authenticated caller's
  own session token in the installed configuration; the settings change is
  credential minimization for the custom UI and does not filter that native
  endpoint. No live database or provider calls, commits, pushes, or deployments.

- Dotted dynamic API body hardening (local): chat thread rename/message routes
  and the development-only local-reference action route now own a 65,536-byte
  JSON limit through the shared reader. Oversized bodies return 413 and
  malformed JSON returns 400. This is necessary because the proxy matcher
  skips dotted paths; focused route tests were added before implementation.
  No provider or database calls.

- Security hardening (local): bounded transactional delivery-state retention
  and mail-preview outbox, custom-domain resolver TTL/cap, generic duplicate
  waitlist replies and durable fail-closed public admission, registered tenant
  schedule types, hourly minimum cadence, workspace quotas and fair claims.
  Storage uploads use stable workspace/owner keys, serialized replacement,
  bounded legacy cleanup and admission before parsing; outbound webhook DNS/HTTP
  work shares a deadline and attempt-fenced completion. Production container
  startup forces production configuration even when an environment file
  supplies local mode. Concurrent custom-domain creation is serialized by
  workspace before quota checks; platform flag and announcement reads require
  an admin session before database access.

  Auth repairs now disable direct password signup, require a one-use 15-minute
  first-password proof bound to the exact successful email-OTP session/user,
  and revoke legacy accounts, sessions, passkeys, two-factor rows, and active
  API keys before mailbox recovery promotes an unverified owner; it also clears
  `twoFactorEnabled`. The adapter wrapper resolves the exact update target,
  including magic-link's id-only update, and cleanup failures prevent promotion.
  OTP reset keeps only the credential being replaced after matching email-code
  proof. Native passkey/TOTP enrollment requires an authoritative verified,
  nonbanned session; passkey session creation also reloads the owner and exact
  persisted credential. TOTP state updates and replacement-session creation
  now re-read the persisted verified owner, current session, and current factor;
  `/link-social` account creation checks its live owner/session too. OAuth
  `link-account` callbacks use `getAuthoritativeSessionFromCtx` and require the
  session user to match the exact target user ID. Handler tests cover stale
  `/link-social` recovery (417, no link), stale normal callbacks
  (`SESSION_REVOKED`, no link), and active verified controls; provider exchange
  and identity are local mocks. The app session projection rejects absent, unverified,
  or banned users before workspace operations. Existing Better Auth OAuth
  identities require a persisted verified, nonbanned owner even with invite-
  only mode off; `account.updateAccountOnSignIn` remains enabled for recovery.
  Auth.js rechecks the exact provider link after owner validation, reloads live
  identity/role in callbacks, and accepts only `provider-account-v2` (older
  token versions are denied). Supa's Turnstile reset aliases
  `/request-password-reset` and `/forget-password` are covered: the handler
  rejects missing CAPTCHA before mail and sends with a valid mock CAPTCHA. Web
  and mobile organization seat operations, including owner demote/remove/leave,
  share a workspace-scoped advisory transaction for actor, target, count,
  policy, and write checks. Full unit suite: 2,081 passed, 35 skipped
  (262 passing files, 10 skipped files). Focused auth tests: 69/69; typechecks
  18/18, full lint, and builds 18/18 passed. Auth.js also uses the shared early-access hooks: in invite-only mode,
  new social users
  need a valid invite for their normalized provider-verified email or an
  `ADMIN_EMAILS` address; existing verified users and open mode retain their
  prior behavior. Invite validation atomically binds an unredeemed, unexpired
  code to the first normalized, provider-verified mailbox; a different mailbox
  loses the conditional update, while the same mailbox can retry after a
  failed user insert. Code redemption and referral attribution remain
  post-create. Final repository formatting validation passed. No
  live PostgreSQL, provider, Docker, or WebAuthn-hardware checks were
  performed. No commits, pushes, deployment, or live provider/database
  mutations performed.

- AWS SES SDK support accepts IAM-role/local-profile credentials or complete explicit keys with optional AWS_SESSION_TOKEN. Classic IAM SMTP setup and pricing guidance uses backend-only credentials shared by web, mobile and desktop. The walkthrough and its mirror ship to every platform checkout. Verification: the full lint/typecheck/test/format gate passed (19 typechecks, 1,877 tests; 35 gated skips), all 18 production builds passed including iOS/Android exports, and all 48 sync-manifest cases passed after adding guide shipping. The release build also repaired lazy agent source imports; all 20 agent tests passed. Real AWS delivery remains unverified; credential tests are offline.

## Current Work (2026-10-03)

- Budgeted agent runs (local, `feat/beta-feedback-hardening`): new server-only `apps/web/src/agent-budget.ts` exports `runBudgetedAgent` (DI) — resolves the workspace AI context, loads the catalog model/price via injected `findModel`, records an `agent.run` task row, reserves the `maxSteps`-scaled `estimateConservativeUsage` cost through `authorizeAiProviderAttempt` (denial throws `WorkspaceBudgetExceededError`/`AiProviderAttemptAuthorizationError` before the runner is created), runs the injected `AgentRunner` with caller-scoped `ToolContext` + scope-filtered shared workspace tools, appends actual `ai_usage`, settles the hold at real cost (at the estimate when the adapter reports none), and persists `{model, source, text, toolCallCount, toolNames}`; failure releases the hold at 0n unless the run finished and marks the task failed. Guardrails added in review: `keyMode === "byok"` → `AgentByokUnsupportedError` (agent runs bill the platform key — never silently spend it on a BYOK workspace); tool-scoped runs against a `capabilities.tools === false` catalog model → `AgentModelCapabilityError`; both fire before the task row. `ai-task-runtime.ts` gained `getAgentRunRuntime().runAgent(input, tools)` (wires `createWorkspaceAgentRunner` via a lazy `import("./agent-runtime")` inside `createRunner` — a static import would pull the provider SDKs into every consumer — plus repositories and `readCurrentModels(provider, now, modelId?)` — new optional `eq(aiModel.id, modelId)` filter; router call site unchanged). Still no public endpoint — this helper IS the budget path. `modules/agent-frameworks` guide gained the worked-example + BYOK paragraphs (en/de/es/fr via `beginners.*.json`). Verification: 17 agent-budget + 11 ai-task-runtime tests (new wiring describe pins `eq(aiModel.id)` + the lazy forward), chat-budget/scheduler-runtime/docs-i18n suites green; web typecheck clean.

- Explicit licensing (local, `feat/beta-feedback-hardening`): new `LICENSE.md` at repo root mirrors the `/legal/license` terms (`licenseAgreement` in `legal-content.ts` — unlimited end products, no codebase redistribution/repackaging/public-repo publication, per-developer seats, revocation on breach). All 20 workspace `package.json` manifests carry `"license": "SEE LICENSE IN LICENSE.md"`. README gained a `## License` section; `scripts/subrepos.mjs` `ROOT_FILES` ships `LICENSE.md` to buyer checkouts, `renderRootPackageJson` emits the same license pointer, and `renderReadme` gained the matching section. Verification: 45/45 `tests/subrepos.test.ts` green incl. new manifest/render pins.

## Current Work (2026-10-02)

- Scheduler missed-run accounting (local, `feat/beta-feedback-hardening`): a claimed fire IS the stored `next_run_at` occurrence dispatched late — `claimDueSchedules`/`LocalJobScheduler.tick` now add `countCronRuns(cron, stored, now)` (strictly-after, ≤now; saturates at `MAX_MISSED_RUN_COUNT=10_000`) into the new `job_schedule.missed_runs` column (additive migration `0013_gray_pixie`), and claimed rows return `ClaimedCronSchedule` (`missedDelta` + post-claim cumulative; dryRun projects without writing). Tick item results carry `missedDelta` (the row's counter stays cumulative `missedRuns`); `WorkspaceScheduleRow` lists it and the Cron schedules settings list shows `· missed N` when > 0; the `modules/scheduled-digest` guide explains the recovery semantics in en/de/es/fr. Verification: 43 jobs + 92 db + 42 focused web tests pass (6 Postgres integration cases DB-gated/skipped), three typechecks green; integration coverage unverified without TEST_DATABASE_URL. No push.

- Desktop CI hardening (local, `feat/beta-feedback-hardening`): `.github/workflows/ci.yml` gained a `desktop` job — a `fail-fast: false` matrix over ubuntu/windows/macos that installs the pinned pnpm/Node toolchain, caches cargo per-OS (`Swatinem/rust-cache`), installs the Tauri apt deps plus FUSE (`libfuse2` → `libfuse2t64` fallback) on Linux only, then runs `pnpm --filter @supastack/desktop test` and a real `tauri build` per webview engine. Beta feedback had flagged that CI only ran `cargo check` and never exercised installer builds off Linux. Structure pinned by new `tests/ci-workflow.test.ts` (line-scan, no yaml dep); all 88 `tests/` cases and the 11 Rust tests pass locally. Windows/macOS runner behavior and AppImage bundling remain unverified until the job runs on GitHub-hosted runners.

- First-run config repair completed locally: blank `CREEM_TEST_MODE`, `MAILGUN_REGION`, and `SMTP_SECURE` now use their existing defaults. Regression coverage reads the shipped `.env.example`, checks blank/whitespace and explicit options, and preserves invalid-value rejection. Config/setup/mirror suites: 56 tests passed; config typecheck and scoped ESLint passed. No publication.
- Windows fresh setup (verified 2026-10-03): build defaults to read-only Turbo cache on Windows;
  explicit cache choices remain supported. E2E scripts prepare pinned Chromium,
  the local gate clears Web's Next cache between suites, Next typechecks generate
  ignored route/environment types, and Windows Vitest workers are capped at four.
  Sitemap warm-up now shares one documentation catch-all representative per
  locale, retaining all other page modules; traversing every guide URL exhausted
  Next dev memory before browser assertions could run. Regression tests passed.
  Blank optional config settings from `.env.example` now parse to their defaults.
  The complete local gate passed on remote main `19bc374` plus this repair:
  1,831 tests (34 gated skips), 18 typechecks, 18 uncached builds, 34 local E2E
  and 15 production-interface E2E cases. Copied example configuration and cold
  Next/Turbo caches were used; build exited normally and no memory restart
  occurred. Windows CI repeats the full documented setup. See
  `docs/superpowers/plans/2026-10-02-windows-fresh-setup.md` for exact receipts.

- Beginner documentation revision completed locally: 162 guides with two preparation/terminal guides, exact three-platform first-run instructions, per-app environment loading, local-demo versus database-backed sign-in, and topic-specific feature/provider/block/reference walkthroughs. English/German/Spanish/French coverage is integrated; full shell commands, code, paths and guide identifiers are preserved. README and the separate setup app align with the canonical docs. Verification: 45 focused resource/sitemap/setup tests, Web typecheck, scoped ESLint, formatting and nine Chromium documentation cases passed. Real provider transactions, physical-phone setup, native signing and macOS/Linux desktop builds remain unverified for this docs revision. Work stays local. See `docs/superpowers/plans/2026-10-02-beginner-documentation.md`.

## Current Work (2026-10-01)

- Platform parity implemented locally: desktop cold-start/running/second-instance deep links and exact-origin routing; Expo model/output controls, request cancellation and native RevenueCat purchase/restore; server-verified workspace entitlements with authenticated reconciliation/webhook routes. Desktop remains a shell around Next.js. Purchases default off, production rejects sandbox grants, secrets stay server-only, and owner/admin roles gate reconciliation. Verification: 1,791 deterministic tests passed (34 gated skips), focused purchase/config checks passed, Web production build and both mobile exports passed, Rust tests/check/fmt and unsigned Windows installer build passed. Real StoreKit/Play transactions, EAS device builds, signed installers and macOS/Linux native acceptance remain unverified. No push, deployment or store submission.

- Public docs overhaul implemented: 160 guides covering features/providers/blocks/environment/routes/platforms, with valid topic continuations and 17 separate setup-flow destinations. Web, Expo and Desktop each begin with a five-minute local tutorial marked by a brand-colored Zap; Desktop has its own tab. The user authorized the inline setup sentence and icon refinement while preserving the page shell. Database setup links inline to payments while bottom pagination leads to deeper database setup. The 977 core strings align across en/de/es/fr; eight Chromium docs cases passed, including 320px no-JavaScript reading. Matching Markdown exports include both destinations. Changes stay local.

## Previous Work (2026-09-29)

- Pinned open source Motion 12.23.26 is installed in `apps/web` and the lockfile for product loading-state reuse. Existing observability branch work remains intact.
- Document the shipped observability correlation/alerting feature (plan Task 6): `ALERT_WEBHOOK_URL` in `.env.example`, extended `modules/observability` guide, `.ai` mirrors, and the plan doc. Preserve the Motion dependency edits above.

> Last updated: 2026-10-02 | Status: standalone supastack kit repo

## Purpose

Universal modular Web + Mobile + Desktop AI SaaS starter kit — the copyable block
library + product foundation other products compose blocks from.

Convention: `.ai/` mirror docs describe this repository only — they must
never reference other repositories, private products, or maintainer-only
checkouts.

## Current Work

- 2026-09-29 — **Observability correlation, alerting & duration metrics (local, `feat/observability-correlation-alerting`).** Docs pass for the already-committed feature: `.env.example` gained `ALERT_WEBHOOK_URL` beside `SENTRY_DSN`/`NEXT_PUBLIC_POSTHOG_*` (generic HTTPS endpoint, `{text,name,severity,context}` POSTs). The `modules/observability` guide in `resources/content.ts` gained `correlation` (corr_<uuid> minted at AI-task submit / all eight billing webhook routes / scheduler dispatch; rides `job.completed`/`ai_task_completed` props, `captureException` extras, `webhook_event` ledger + `webhook_delivery` payload meta; missing/invalid tolerated), `alerting` (`serverObservability.alert` fire-and-forget 5s POST, noop when unset; `job.failed` warning + `webhook.delivery_failed` critical on terminal failure only), and `metrics` (`measure` → `<name>.duration` events incl. `ai.task.execute`; `logger` one redacted JSON line per record). Mirrors updated: `.env.example.md`, `resources/content.md`, new `docs/superpowers/plans/2026-09-28-observability-correlation-alerting.md` mirror.

- 2026-09-28 — **Mobile store-submission path + docs expansion (local).**
  `apps/mobile` gained `eas.json` (development/preview/production build
  profiles, `appVersionSource: remote`, Android submit → internal-track
  draft via `secrets/play-store-service-account.json`), store identifiers
  in `app.json` (`com.supastack.app` placeholders), `build:*`/`submit:*`
  package scripts, and a git-ignored `apps/mobile/secrets/` rule. New repo
  doc `docs/mobile-store-submission.md` (accounts → identifiers → signing →
  Play service account → console forms → RevenueCat gate → rejection
  playbook → checklist). Site docs gained five guides: flagship
  `mobile/store-submission` ("Distribution", full sections + `items[]`
  checklist) in `content.ts`, plus `mobile/in-app-purchases`,
  `web/kit-blocks`, `modules/public-api`, `web/seo-public-pages` in
  `additional-guides.ts`; `mobile/builds` and `mobile/entitlements`
  cross-link them. New `.ai` mirrors: `apps/mobile/eas.md`,
  `docs/mobile-store-submission.md`. No push or sub-repo sync.

- 2026-09-28 — **Local branch consolidation.** Merged the four current
  `origin/devin/*` branches into `main`: CI E2E warm-up, mobile API surface,
  mobile app parity, and desktop shell parity. Their matching `.ai/` mirrors
  merged with the code. Removed three already-merged local topic branches;
  preserved the divergent, product-specific `feat/phase1` tip as local tag
  `archive/feat-phase1-2026-09-28` before removing its branch name. The
  pre-consolidation `main` tip is tagged
  `archive/main-before-consolidation-2026-09-28`. Verification on the merged
  tree: 19/19 typechecks, 1,633/1,633 runnable tests with four Vitest workers,
  ESLint and Prettier passed. Remote refs remain unchanged; this work is local.

- 2026-09-28 — **Windows verification open notes.** With the documented
  Corepack shim, `corepack pnpm build` reported 18/18 successful Turbo tasks
  twice but the root Turbo process did not exit after its summary; direct
  `@supastack/web` build exited 0. Writable shared and worktree-local Turbo
  caches both reproduced the stall; read-only cache mode let the root build
  exit 0 with 18/18 tasks. The complete `verify:local` chain was not run as
  one command. Next dev/build alternates the tracked Web
  `next-env.d.ts` imports between `.next/dev/types` and `.next/types`; the
  generated change was restored, with no repo fix attempted.

- 2026-09-28 — **Windows E2E concurrency follow-up (local).** The current
  25-test local suite failed once at the Windows machine default of 11: a Docs
  client navigation fetched `/docs/mobile` successfully yet remained on
  Introduction (24/25). Capped Windows workers at four; full suite passed
  25/25 both with explicit `--workers=4` and with the default command. The
  real navigation assertion remains; non-Windows workers are unchanged.

- 2026-09-28 — **Corepack sub-repo render follow-up (local).** Root `check`
  invokes `corepack pnpm test`; the desktop no-tests renderer still matched
  only the old bare `pnpm test` and emitted a call to its removed test script.
  The renderer now filters standalone test-script commands from the composed
  check chain, preserving other steps and their order. A test against the
  current root package and desktop file manifest caught the bug (RED 2/5),
  then both relevant suites passed 51/51; targeted lint/format passed. No
  sub-repo sync or buyer checkout edit occurred.

- 2026-09-28 — **Windows Corepack gate follow-up (local).** Root acceptance
  scripts now recurse through `corepack pnpm` without changing steps or order;
  `check` still includes desktop typechecking and `verify:local` excludes it.
  Turbo independently resolves `pnpm` for workspace tasks, so README shows a
  non-elevated `corepack enable --install-directory` bootstrap into a
  user-writable folder and a session `PATH` update. A shim-free smoke exposed
  Turbo's missing-binary error; with only Corepack's generated shim, the full
  `check:local` passed (18 typechecks, 1,594 runnable tests, Prettier). The
  focused setup contract passed 9/9; full build/browser suites were not run.

- 2026-09-28 — **Reusable testimonial template (local).** `testimonial-grid` owns its optional section heading, intro, anchor, four-card layout, language attributes, avatar slots, and five-position ratings. `/kit-blocks` demos it with clearly fictional example content; the default public landing must not use testimonials or customer proof. Inherited marketing wrappers follow style density, radius, and font alongside color. Browser-checked all 13 `STYLE_CATALOG` styles and 390px layout, with no horizontal overflow; focused tests passed. No push or sub-repo sync.

- 2026-09-27 — **Windows and adoption feedback follow-up.** Existing LF
  checkout rules, long-path notes, Coolify/custom-billing guides, tier-gated
  content, `email.digest`, and chart blocks were verified. The README and
  docs now set Expo starter scope early and include selective-adoption,
  revision-upgrade, and bounded Defender troubleshooting guides. Playwright
  no longer reuses any process on its port: a different local app occupying
  3100 had caused 14 false E2E failures. With `PLAYWRIGHT_PORT=3123`, the
  local suite passed 25/25; the separate production suite passed 15/15.
  Full unit tests passed 1580/1580 runnable after two cold-import tests got
  bounded 15-second timeouts. The `.ai` boundary test passed after removing
  stale external-checkout wording from mirrors.

- 2026-09-27 — **`feat/vps-coolify-billing-docs` merged into `main` +
  branch deleted (local).** Merge commit `2a78db8` on `main` (clean, no
  conflicts) brought in all ~33 feat commits; the branch is gone locally
  and the primary checkout now tracks `main`.
  Below entries' `feat/vps-coolify-billing-docs`/`uncommitted` tags are
  historical. Remote state: `origin/main` already holds this work through
  PR merges #4–#6 up to `0a79bbe` — only `7ca3ae8` + `f9418ea` + the
  merge commit are local-only (main: ahead 3 / behind 3 vs origin;
  `origin/feat/vps-coolify-billing-docs` still exists). Not pushed —
  reconcile origin/main before any push.

- 2026-09-27 — **FAQ widget backdrop removed (local).**
  `faq-browser.module.css` `.dialog::backdrop` is now `transparent` —
  opening the floating FAQ panel no longer dims the marketing page.
  Declared (not deleted) because the UA default `::backdrop` still tints;
  the transparent layer still covers the viewport so light-dismiss, Esc,
  and focus containment keep working. New mirrors: `faq-browser.md`,
  `faq-browser.module.md`.

- 2026-09-27 — **Analyst/content-product feature set (local,
  `feat/vps-coolify-billing-docs`, committed).** Three additions for
  content/analyst products built from the kit. (1) Tier-gated content:
  `content_entry.required_entitlement` (nullable varchar(100), migration
  `0012`) gates published entries by workspace entitlement; `"report"`
  joins the content types; `content-access.ts` projects locked rows
  (teaser metadata kept, `body: ""`, `locked: true`); public reads live
  in server-only `content-queries.ts` — never on the `"use server"`
  module, so entitlement claims can't be forged by clients; the CMS form
  edits the gate and shows a tier badge. (2) Scheduled digest:
  `email.digest` workspace job (details in the entry below). (3) Data-viz
  block set: `chart-line` (marketing), `data-viz-bars` /
  `data-viz-donut` / `metric-trend` (app) — self-contained pure-SVG
  blocks, token-only CSS, `role="img"` + aria-labels, visually-hidden
  data tables, zero-baseline bars, ≤6-slice donut; plus `paywall-gate`
  (app) — the locked-content teaser/upgrade CTA. All registered in
  `src/kit/blocks.ts` and demoed on `/kit-blocks`.

- 2026-09-27 — **`email.digest` scheduled content digest (local).** New
  `apps/web/src/digest-job.ts`: the workspace job type
  `upsertScheduleAction` has always suggested now actually runs —
  `parseDigestInput` validates `job_schedule.input` (`lookbackDays` 1–90,
  default 7; `type` via `normalizeContentType`), `buildDigestMessage`
  renders `• Title (type) [<key> tier]` lines (gated entries tagged, not
  filtered — recipients are the publishing team), and
  `createEmailDigestHandler` sends one transactional email per member
  (sequential; per-recipient failures counted, not fatal) then tracks
  `job.completed {entries, sent, failed}`. Registered on
  `mutableJobHandlers` via lazy `import("./digest-job")`; NOT in
  `PLATFORM_JOB_TYPES` — the null-workspaceId skip lives inside the
  handler. New `modules/scheduled-digest` docs guide covers schedule
  setup, the tick path, and `job_schedule.input` (the settings form
  stores type + cron only). 20 new tests green; review pass added
  `MAX_DIGEST_RECIPIENTS` (100) against the per-handler timeout,
  excerpt collapse/200-char cap, and a `logError` sink for send
  failures.

- 2026-09-27 — **Security-batch review fixes, second pass (local only,
  uncommitted, `feat/vps-coolify-billing-docs`).** `linkAuthJsSocialUser`
  now survives concurrent social sign-ins: both inserts run
  `onConflictDoNothing` on `idx_user_email` / `idx_account_issuer_account`
  and re-read the committed winner's row, so a doubled OAuth callback or a
  two-provider email race resolves the winning identity instead of dying on
  a 23505 (which would abort the transaction). The GitHub
  `/user/emails` verification fetch pins `redirect: "error"` so the bearer
  token can never ride a redirect; the `jwt` callback strips `token.sub`
  alongside `token.userId` on unversioned legacy tokens. All seven
  bounded-read billing webhook receivers (`stripe`, `creem`, `dodo`,
  `lemonsqueezy`, `paddle`, `polar`, `whop`) now run `readWebhookPayload`
  inside the `try`, matching `paypal`: non-oversize stream failures reach
  `captureException` → 500 instead of escaping the handler. New
  `app/api/billing/webhook/routes.test.ts` covers all seven (mid-read
  stream error → 500 + report, oversize → 413, normal → 200). Open Threads
  recorded: authjs social sign-in skips `provisionPersonalWorkspace` and
  the invite gate (pre-existing), `findWorkspaceContext` `.limit(1)` is
  unordered while the write gate makes the first membership's role
  decisive, `normalizeWorkspaceRole` fails open to `"member"`, and
  authenticated JSON routes still read bodies unbounded pre-auth.

- 2026-09-27 — **Public `/legal/license` page (local, uncommitted).**
  New `licenseAgreement` document in `marketing/legal-content.ts` —
  one-time-purchase framing, ongoing non-exclusive worldwide grant, can-do /
  can't-do bullet lists (`LegalSection.items` is new and optional), seat rule,
  revocation. Buyer-safe phrasing: no prices, checkout, or delivery mechanics.
  `legal-page.tsx` renders `items` as `<ul>`; `utility-page.module.css` gained
  `.prose section ul`/`li`/`::marker` rules. New route
  `app/legal/license/page.tsx` (`force-dynamic`, canonical + metadata),
  `MarketingSection` +`/legal/license` footer link in `siteConfig.footerLinks`,
  new `isActiveSection(href, active)` suffix predicate drives `aria-current`
  in site-header (3×) and site-footer (3×). Sitemap entry yearly/0.3. New
  mirrors: `legal-content.md`, `legal-page.md`, `site-footer.md`. Marketing
  tests + e2e spec extended; vitest 27/27 green.

- 2026-09-27 — **Public `/legal/acceptable-use` + `/legal/disclaimer` pages
  (local, uncommitted).** Two more documents in `marketing/legal-content.ts`
  (`LegalSlug` += `"acceptable-use" | "disclaimer"`): the AUP carries the
  prohibited-activity `items` bullet list (unlawful/IP-infringing material,
  spam/unconsented messaging, malicious activity, harassment, plus generic
  enforcement/changes sections); the disclaimer covers general-info-only,
  no warranties, external links, views/fair use, use-at-own-risk. Generic
  product wording is guarded by `legal-content.test.ts`. New routes
  `app/legal/acceptable-use/page.tsx` +
  `app/legal/disclaimer/page.tsx` (`force-dynamic`, canonical + metadata),
  `MarketingSection` +`acceptable-use`/`disclaimer` (suffix predicate covers
  them — `/legal/acceptable-use` ends with `/acceptable-use`), footerLinks
  +2 entries, sitemap +2 yearly/0.3 entries. E2e spec walks both pages.

- 2026-09-27 — **XFF trusted-tail rate-limit keys.**
  `rateLimitKeyForRequest` derives anonymous keys from the
  `x-forwarded-for` entry `trustedProxyCount` hops from the right — only
  proxy-written tail entries are trusted, so spoofed/rotated leading entries
  cannot move the key when a trusted proxy count is configured. The direct
  deployment default keeps all anonymous callers in one bounded bucket. New
  `TRUSTED_PROXY_COUNT` env (0–10, safe default 0) →
  `serverConfig.rateLimit.trustedProxyCount`, read once in
  `rate-limit-runtime.ts` and passed through `rate-limit-route.ts`.
  Missing/short/malformed chains → shared `prefix:ip:unknown`; IPv4 `:port`
  suffixes are normalized (IIS/ARR). Focused web + config tests passed.

- 2026-09-27 — **Codex Security six-finding remediation.** Shared billing checkout/portal require owner or admin; chat/task writes require member or higher. Auth.js links social users by provider subject and verified email, and versioned tokens reject older email-derived sessions. Anonymous rate limits ignore forwarding headers unless trusted proxies are explicitly configured; public leads retain their 100/hour global cap. All billing webhooks and image uploads enforce streaming body limits; PayPal verification has a global quota, header caps, and a concurrency gate. Repository lint, all 18 non-desktop type checks, 1,518 tests with four Vitest workers, and formatting passed.

- 2026-09-27 — **Security-batch review fixes (local only, uncommitted).**
  Webhook deliveries now claim each row atomically before attempting —
  `UPDATE … attempts+1, next_attempt_at = now+30s lease WHERE pending AND
  still-due RETURNING` — so the emit-inline path and overlapping sweeps can
  never double-deliver, and a crash re-exposes the row at lease expiry; the
  pinned DNS target rotates across the validated answers per attempt. The
  advisory AI spend snapshot bounds usage to `[monthStart, nextMonthStart)`
  matching the authorization path. `isPubliclyRoutableHost` also blocks
  `64:ff9b:1::/48`, `2002::/16` (6to4), and `2001::/32` (Teredo); in-memory
  limiters throw on non-finite `maxBuckets`; `chat-budget` shares the
  executor's `safeTokenNumber`. New `ai-task-runtime.test.ts` pins the
  month-window bound; 137 focused tests + web typecheck green. Deferred to
  Open Threads: `Retry-After` on the BFF 429 (no header channel in the v1
  contract) and a reaper for stuck `reserved` budget holds.

- 2026-09-27 — **Five security findings remediated (local only).** Production
  webhooks pin a validated public DNS address to the HTTPS socket —
  `https.request` `lookup` answers only the validated host with the
  validated address (`family` pinned, `agent:false`), closing the
  lookup→connect rebinding gap — while preserving TLS hostname
  verification. Contact/newsletter actions and the
  shared AI task BFF have fail-closed submission limits. Platform-funded AI
  tasks use a $5 monthly default when no explicit policy exists; DB budget
  reservations lock the workspace row so this default serializes. Synchronous
  chat now shares the submission limits and reserves budget before provider
  calls. Idempotent queued-task retries remain available under exhausted
  limits, and memory limiter buckets are capped. The fake local-reference API
  returns 404 in production, and `/status` calls the shared health probe
  directly. Focused web and DB tests pass, including the optional PostgreSQL
  suite against an isolated test container. No push, merge, or deployment.

- 2026-09-27 — **Nine-finding critical review fix batch
  (`feat/vps-coolify-billing-docs`, local).** An external review
  (baseline `6ef28b6`) flagged 9 criticals; each was verified against
  source, fixed TDD, and two-stage reviewed. Security: storage object
  route now requires session + `workspaceMembership` row on both
  `workspaceId` and `userId` (IDOR closed; `nosniff` on responses);
  production webhook endpoints reject private/reserved/local
  destinations incl. alternate IPv4 forms, IPv6/link-local/NAT64/
  translated forms, local suffixes, single-label hosts, and DNS-resolved
  non-public answers, with `redirect: "manual"` (SSRF closed); dynamic
  trusted origins validate/dedupe via `toExactWebOrigin` and fail
  closed; `sk_` API-key task calls pass an explicit caller instead of
  forwarded headers (identity + pinned workspace); Creem/Lemon Squeezy
  webhook verification guards null/non-string inputs and always runs
  `timingSafeEqual` on equal-length buffers (no throw, no timing
  oracle). Bugs: webhook deliveries initialize `nextAttemptAt`, the
  due-sweep includes `IS NULL` rows, and `platform:webhook.delivery-sweep`
  (`* * * * *`) is wired into the platform schedule (retries actually
  run); failed AI task runs release every authorized budget reservation
  (winner settles at real cost, holds release at `0n`, per-run nonce
  ids); API v1 maps the persisted entitlement domain
  (`active|trialing|past_due|inactive`, unknown→inactive) instead of the
  stale `gracePeriod|expired|revoked` domain (500s gone); sub-repo sync
  rebases local commits onto the remote tip instead of force-resetting
  (unpushed commits preserved) and dry-run restores refs/HEAD/index on
  every exit. Residuals documented in `.ai`: reservation crash-gap until
  month rollover (no TTL/reaper), DNS→fetch TOCTOU (closed by the
  2026-09-27 five-finding batch — pinned-lookup HTTPS delivery),
  stranded-branch blind spot in sibling sync.

- 2026-09-27 — **Dry-run restores sibling refs on every exit (local).**
  Follow-up fix: the "up to date" `diff --cached --quiet` early return ran
  before the sibling dry-run restore, so a no-change dry-run still left
  HEAD switched and `refs/heads/<branch>` moved. The unwind is now
  `restoreDryRunSibling` in `subrepos.mjs` (restoreCheckoutState →
  `reset --hard`/index drop → untracked synced-file removal; GENERATED +
  pruneEmptyDirs lifted too), called from both dry-run sibling exits;
  rebase-failure unwind gained a `--abort`→`--quit` fallback; fixture repos
  pin local committer identity for `useConfigOnly` runners. Known
  limitation documented: a `<branch>` tip diverged from HEAD is still
  reset on the success path (reflog-recoverable) — keep siblings on the
  sync branch. 37/37 subrepos tests green.

- 2026-09-27 — **Sub-repo sync preserves unpushed commits; dry-run restores
  refs (`feat/vps-coolify-billing-docs`, local).** `syncRepo` positioned
  branches via `checkout -f -B <branch> origin/<branch>`, silently
  orphaning local commits — e.g. a `chore: sync` commit whose push failed —
  and `--dry-run` restored file contents but not refs. Git plumbing
  (`runGit`/`git`/`gitOrThrow`/`listGit`/`GIT_ENV`) moved from
  `sync-subrepos.mjs` into `subrepos.mjs` exports; new
  `captureCheckoutState`/`positionBranch`/`restoreCheckoutState` replay
  local commits onto the remote tip via `git rebase`, restore the checkout
  on rebase conflict, and make dry-run restore refs/HEAD/index byte-
  identical. `siblingGuard` still runs first — its pre-positioning probes
  are load-bearing. 7 new real-git tests (tmp dirs only), 36/36 green.

- 2026-09-27 — **`writing-changelogs` skill added (local, uncommitted).**
  New `.agents/skills/writing-changelogs/SKILL.md` — writing guidance for
  public changelog/release-notes bullets: one shipped capability per
  bullet, outcome-led, no implementation mechanics or root causes,
  `Fixed:` + visible symptom for fixes. `.agents/` is not in the subrepo
  sync manifest, so it stays monorepo-local.

- 2026-09-26 — **`.ai/` mirror docs ship to sub-repos
  (`feat/vps-coolify-billing-docs`, unpushed).** Buyer-facing sync now
  carries the agent-memory tree: `buildFileManifest` adds each shipped
  file's `.ai` mirror (strip-ext/append/dotfile-strip candidates, first
  hit) + `.ai/PROJECT_CONTEXT.md` (`.ai/README.md` excluded — README is
  generated downstream); `renderAiMirror` scrubs `INTERNAL_ONLY_LINE`
  lines in transit and returns `null` for husk docs (headings/separators
  only) so `mirror()` skips them; `renderAgentsMd` now filters via the
  shared regex so the `.ai/` memory rule survives downstream (only the
  `Sub-repos (` bullet + internal-only lines still drop); `.prettierignore`
  gained `.ai/` (fixes the monorepo `format:check` + keeps subrepo
  `format:check` green once `.ai` ships); AGENTS.md Sub-repos bullet
  rewritten for the new contract. 29 subrepos tests green; manifests:
  web 310 / mobile 15 / desktop 12 `.ai` files, 0 husks, 0 banned-term
  residuals. Local commit only — no sync/push. Follow-up 2026-09-27:
  caught the stale-checkout drop — the second `check-ignore` ran before
  `mirror()` wrote the new `.gitignore`, so a checkout whose previous
  revision still ignored `.ai/` dropped every mirror doc from `files`;
  `applyShippedIgnoreRules` in `subrepos.mjs` now pre-writes each shipped
  `.gitignore` before the pass (`ignoredPaths` lifted there too).

- 2026-09-27 — **OG card reliability (complete, local only).** Shared card is
  `apps/web/public/demo-social.png` (1200×630), explicitly referenced by root and
  homepage OG/Twitter metadata. The root generated image route was removed;
  blog article cards remain generated per slug. `AGENTS.md` now states the
  placement and crawler check. Social metadata tests (7), SEO tests (13),
  web typecheck, formatting, and local rendered `/`, `/de`, article, and
  `/demo-social.png` responses passed. No push or deployment.

- 2026-09-26 — **VPS + Coolify self-hosting docs (`feat/vps-coolify-billing-docs`,
  unpushed).** Buyer request: a cheap-VPS deploy path without Vercel/Railway.
  New `docs/vps-coolify.md` (sizing: Coolify 2c/2GB/~30GB floor vs ~4GB on-box
  build or CI→GHCR prebuilt image for ~1–2GB tiers; install, ports, Postgres
  options, Dockerfile build pack on :8080 + `/api/health`, runtime-only env
  incl. the `APP_ENV=production` required set, external `db:migrate`, TLS,
  scheduler-tick Scheduled Task vs `JOB_PROVIDER=trigger`, storage/email/
  webhooks, verification pointers). New in-app guide `deploy/coolify-vps` in
  `resources/additional-guides.ts`; `deployment.md` gained a one-line pointer.
  New mirrors `.ai/docs/{vps-coolify,deployment}.md`.
- 2026-09-26 — **Custom billing adapter docs (`feat/vps-coolify-billing-docs`,
  unpushed).** Buyer feedback: no local gateway for SEA (Midtrans/Xendit) — a
  documented recipe helps builders outside US/EU. New
  `docs/custom-billing-adapter.md`: the six-touchpoint checklist for adding a
  `BILLING_PROVIDER` kind (billing package adapter → config enum/envs/gating/
  union + `publicConfigSchema` enum → `productPlanPriceMapFromEnv` arm →
  composition factory/dispatch → `billing-runtime` BFF export → webhook
  route), the contract surface, pitfalls (signature packing, free ledger
  dedupe, `seats` per-adapter, RevenueCat boundary, server-only secrets,
  unroutable events → 500/retry), with a hypothetical `xendit` example — doc
  only, no adapter. New in-app guide `modules/billing-custom-adapter`;
  new mirror `.ai/docs/custom-billing-adapter.md`.
- 2026-09-27 — **`feat/prod-ready-kit` merged into `main` (merge commit
  `b956792`).** Brought in the production-readiness line: shared Postgres
  fixed-window rate limiter (`rate_limit_bucket` 0006 + `rate-limit-store`),
  platform daily AI spend cap (`platform_ai_spend` 0007) + public AI runner,
  connected accounts (X/Google/Microsoft OAuth + SMTP, `connected_account`
  0008 + AES-256-GCM vault + Settings → Connections panel), usage quotas
  (`usage_counter` 0009 + `usage-quota.ts` enforcement seam), durable job
  scheduler (`job_schedule` nullable-workspace platform rows 0010–0011,
  `createDrizzleJobScheduler` FOR UPDATE SKIP LOCKED claim,
  `/api/internal/scheduler-tick` gated by `SCHEDULER_TICK_SECRET`,
  `scheduler.tick` Trigger.dev cron, `pnpm jobs:tick`), `completeStructured`
  with schema validation + one repair retry, minimal theme pack +
  `minimal-product` style + 8-block minimal marketing set + `/kit-blocks`
  showcase, and `appendSyncAiUsage` for non-task completions. Conflicts
  resolved as unions (kit `blocks.ts`/`blocks.test.ts`,
  `kit-blocks.module.css`, config `index.ts` NODE_ENV + paddle/paypal envs).
  `feat/phase1` (an outreach-product branch) stays unmerged — it contains
  prod-ready-kit as ancestor + product work that is not kit content. All
  new `.ai` mirrors written (connected-accounts/scheduler/quota stacks,
  migrations 0006–0011, test docs); existing mirrors' change histories
  updated. Typecheck 18/18, targeted suites green; not yet pushed.
- 2026-09-27 — **`.ai/` published.** Removed from `.gitignore`; all mirror
  docs now tracked in the repo (`ddae81a`). Sub-repo manifests still never
  ship `.ai/` (not in app/closure/ROOT_FILES/extraPaths) and
  `renderAgentsMd` strips `.ai/` lines for buyer AGENTS.md.
- 2026-09-25 — **Billing providers += Paddle, Dodo Payments, PayPal
  (`c155ca1`, pushed; phase B5).** `BILLING_PROVIDER` now accepts all nine kinds
  (`local|stripe|lemonsqueezy|creem|polar|whop|paddle|dodo|paypal`).
  New `packages/billing/src/{paddle,dodo,paypal}.ts` adapters share the
  framework-neutral BFF contract — injected minimal clients, fetch-backed
  implementations in `server-provider-composition.ts` (`createPaddleClient`
  REST v1, `createDodoClient` REST, `createPaypalClient` OAuth +
  `verify-webhook-signature`). Webhooks: Paddle verifies `Paddle-Signature`
  (`ts;h1` HMAC-hex) locally; Dodo verifies Standard Webhooks locally
  (`whsec_`-prefixed key decoded); PayPal verifies remotely, so
  `billing-bff.ts` `verifySignedWebhook` is now awaited (async-capable).
  Routes: `app/api/billing/webhook/{paddle,dodo,paypal}/route.ts` (PayPal
  packs its five transmission headers via `encodePaypalWebhookSignature`).
  Config: per-provider credential gating + environment defaults + per-plan
  `{PADDLE_PRICE_ID,DODO_PRODUCT_ID,PAYPAL_PLAN_ID}_{PRO,PRO_YEARLY,
  LIFETIME}` envs read by `productPlanPriceMapFromEnv`. Notable deviations:
  Paddle has no per-transaction success URL; PayPal `custom_id` caps at
  127 chars (compact `{e,p,w}` JSON) and ignores seats/customerId
  (per-subscriber plans; portal = hosted autopay page). Tests: adapter
  units (19), config gating (23), composition verify cases (15), bff
  async-verify, product-plans env maps — billing 48 + web suites green,
  `typecheck:local` clean. Also fixed two pre-existing path bugs:
  `tests/e2e/local-setup.test.ts` repoRoot `..`→`../..` and
  `public-routes-dynamic.test.ts` `process.cwd()`→`import.meta.url`-anchored
  APP_ROOT. Docs (`.env.example`, AGENTS, PRODUCT, deployment.md) updated.
- 2026-09-24 — **Fix: deployed sites served localhost absolute URLs (local,
  uncommitted).** Static-prerendered marketing pages evaluated metadata at
  build time while `APP_URL` is unset → canonical/og:image/hreflang baked
  `http://localhost:3000` into the HTML crawlers read (verified in build
  output: `pricing.html`, blog posts). `robots.ts`/`sitemap.ts` had the same
  bug for their absolute URLs. Fix: `force-dynamic` on all public indexable
  routes (`faq`, `blog`, `blog/[slug]`, `contact`, `privacy`, `terms`,
  `showcase`, `docs/[[...slug]]`) + `robots.ts` + `sitemap.ts`; new
  `src/marketing/public-routes-dynamic.test.ts` pins the contract driven by
  `marketingStaticPaths`. Verified: `next build` route table now shows every
  public route + robots/sitemap as `ƒ`. Pure redirect stubs (`/pricing`)
  intentionally untouched. Second half of the fix: **page-level og/twitter
  wholesale-replacement** — Next merges metadata per top-level key, so a
  page's own `openGraph`/`twitter` object wiped the layout's
  siteName/type/locale (a live product site had NO og:image + card="summary"
  for this reason). New `pageSocialMetadata()` in `src/marketing/seo.tsx`
  composes the shared fields; `[locale]/page` + `blog/[slug]` now call it
  (siteName = `getRequestBrand().name`); `social-metadata.test.ts` pins the
  helper shape + greps all segments for bare `openGraph:`/`twitter:`
  literals.
- 2026-09-24 — **Minimal marketing set + `minimal` pack (branch
  `feat/prod-ready-kit`).** Ported an approved minimal-marketing mockup
  grammar into the kit: `minimal` pack (white paper,
  `#0D7377` teal, ink pills) + `minimal-product` style (comfortable/
  round/geometric/topnav/outline), eight new marketing blocks
  (`product-frame`, `hero-product`, `steps-ruled`, `feature-story`,
  `comparison-ruled`, `pricing-panel`, `faq-split`, `cta-form`), a
  composed "Minimal style" showcase on `/kit-blocks`, and prompt/AGENTS
  docs. Motion is fail-open (scripting+no-preference gating; see
  `.ai/apps/web/src/kit/blocks/marketing/minimal-set.md`). Kit default
  unchanged: Obsidian black, `MARKETING_THEME_MODE="locked"`. Commits
  `7627b39`, `794ee46`, `9236b2f`, `f83cd40`; not pushed.

- 2026-09-23 — **Feedback pending state + generic GitHub linking (local,
  uncommitted).** The workspace feature form now announces a stable loading
  state. GitHub remains visible but disabled before OAuth setup, and the
  production dashboard can link/show a Better Auth GitHub identity using a
  token-free server projection. Local reference mode remains unchanged; no
  fulfillment or repository access logic was added. Setup lives in
  `docs/github-auth-setup.md`.

- 2026-09-24 — **Workspace profile moved to the lower-left rail.**
  `WorkspaceShell` now mounts `UserMenu` in `.app-rail-account`, leaving only
  notification/help actions in the header. The menu opens upward and contains
  only the signed-in email plus sign out; it keeps outside-click dismissal and
  now adds `aria-controls` + Escape focus restoration. Focused Vitest + web
  typecheck pass; browser-verified at 1440×900 and 320×720 with no horizontal
  overflow. No subrepo sync/push was performed.

- 2026-09-24 — **Marketing: always-frosted header + key-press buttons** —
  `src/marketing/marketing.module.css`: `.header` is now frosted at every
  scroll position (`--page` 55% mix + `blur(14px)` + transparent border;
  `.headerScrolled` only deepens to 78%/`blur(16px)`/border-color), fixing
  the latent transparent-header legibility bug when scroll state lagged or
  hydration failed. The `@supports` no-backdrop fallback moved to `.header`
  (opaque `--section` everywhere). Button sheen sweep deleted (user
  rejected it); `.home .btn::after` is now a 2px accent underline that
  `scaleX`s in on hover, shared `.btn:hover`/`:active` became a downward
  key press (`translateY(1px)` / `translateY(2px) scale(0.97)`, mirrored in
  the `no-preference` block). Palette untouched. New mirror doc
  `.ai/apps/web/src/marketing/marketing.module.md`.
- 2026-09-23 — **`otp-input` kit block + `/auth` wiring (Task 1)** —
  `src/kit/blocks/app/otp-input.tsx` + module.css implement the
  single-hidden-input pattern (hand-rolled `input-otp`, no dep): one real
  `<input>` invisible over `length` digit boxes (`data-otp-slot` hook),
  native paste/`one-time-code` SMS autofill, `onComplete` auto-submit,
  controlled-or-uncontrolled, mid dash for even `length >= 4`, token-only
  CSS + reduced-motion caret. Registered in `blocks.ts`, demoed on
  `/kit-blocks` (uncontrolled `label` — server-serializable), and the
  `/auth` otp-verify step now uses it (`OTP_LENGTH = 6`, `verifyOtp(code)`
  extracted beside `requestOtp`, submit gated on all 6 digits). Tests:
  new `otp-input.test.tsx` — vitest `include` widened to `*.test.{ts,tsx}`
  in root + `apps/web` configs to discover it (React's SSR emitter keeps
  prop casing in static markup — assert `inputMode`, not `inputmode`);
  otp-verify case added to `web-auth-page.test.ts`. 24/24 green,
  tsc/eslint/prettier clean. Review follow-ups: `maxLength` dropped
  (truncates pasted separators pre-sanitize) and the caret model is
  append-only (`clampCaret` snaps selection to the end — the invisible
  text↔slot geometry mismatch let mid-string inserts corrupt codes);
  `name`/`ref` passthrough, `data-otp-separator` hook,
  `--button-min-height` slot sizing; auth page gained `otpRef`
  refocus-after-failed-submit and `setOtp("")` on re-request/`select-otp`.
- 2026-09-23 — **feat/prod-ready-kit (upstream tasks 4–6)**: Task 4
  shipped the shared Postgres rate limiter —
  `rate_limit_bucket` (migration 0006), `packages/db/src/rate-limit-store.ts`
  atomic upsert (ISO-string params + `::timestamptz`; raw `execute` cannot
  carry `Date`), async `RateLimiter.check`, `createStoreRateLimiter`
  (fail-open + `onStoreError`), `RATE_LIMIT_STORE` config
  (`postgres` when `NODE_ENV=production`), `rate-limit-runtime.ts`
  `createNamedRateLimiter`, all 8 `rateLimitResponse` callers awaited.
  Task 5 added `packages/ai/src/structured.ts` (`completeStructured` — JSON
  extraction, zod validation, one repair retry; zod added to deps).
  Task 6 added `platform_ai_spend` (migration 0007 — `.default(sql\`0\`)`
  because drizzle-kit can't serialize a BigInt default), atomic
  reserve/release/settle, `PUBLIC_AI_DAILY_BUDGET_MICROUNITS` config, and
  `public-ai.ts`/`public-ai-runtime.ts` (`platform:public` workspace, budget
  `0n` = disabled before router, per-attempt reserve → settle/release).
  Open thread since closed: `pruneExpiredRateLimitBuckets` is wired — the
  `platform:rate-limit.prune` hourly schedule (`scheduler-runtime.ts`) runs
  the `rate-limit.prune` handler (`job-handlers.ts`).
- 2026-09-23 — **"Spread of color" theme-switch reveal** — picking a color
  pack or a design style in ThemePicker now reveals the new theme as a
  clip-path circle growing from the click point via
  `document.startViewTransition`. New `src/theme/theme-transition.ts`
  exports `runThemeTransition(apply, origin?)`: the synchronous DOM
  mutation runs inside the update callback, then `ready` animates a
  `circle()` clip-path on `::view-transition-new(root)` (550ms, repo
  `--ease` curve `cubic-bezier(0.16,1,0.3,1)`, farthest-corner radius).
  `app/globals.css` gained `::view-transition-old/new(root)` rules
  (default animations off, `mix-blend-mode:normal`, new snapshot stacked
  on top) — globals.css because the pseudos are document-level, not
  `.app-theme`-scoped. Origins come from `onPointerDown` on the option
  label (`forId`-guarded against stale refs); keyboard picks fall back to
  the control's rect center. SSR / reduced-motion / no-API / missing-origin
  all degrade to the instant synchronous switch, and rejected
  `ready`/`finished`/`updateCallbackDone` are swallowed. Density/radius/
  font/layout/toast-style axes intentionally stay instant. Covered by
  `theme-transition.test.ts` (node env, `vi.stubGlobal` browser mocks).
- 2026-09-23 — **`Section.table` data tables in articles/docs** —
  `resources/content.ts` `Section` gained `table?: SectionTable
  ({head[], rows[][], accentColumn?})`; `Sections` in
  `resource-pages.tsx` renders a real `<table>` inside a focusable
  `role="region"` scroll wrapper with `scope="col"/"row"` headers and an
  accent column (brand-agnostic — `accentColumn`, not a name check).
  `.tableWrap`/`.accentCell` styles in `resources.module.css`;
  `guideToMarkdown` serializes tables to Markdown pipes and
  `searchGuides`/`buildDocsIndex` index table text. Demo table added to
  `a-foundation-for-your-next-product` (`product-boundary` section).
  New `resource-pages.test.ts` (renderToStaticMarkup + `server-only`
  mock) pins semantics + row-width invariant; resources tests 12/12,
  tsc/prettier clean.
- 2026-09-23 — **`changelog-timeline` kit block added** —
  `src/kit/blocks/marketing/changelog-timeline.tsx` + module.css render a
  rail + spine release timeline (`<ol>`): rail `meta`/`tags`, body
  `badge`/`title`/`kind`/`summary`/`points`/`items`/`more`. `upcoming`
  entries show a hollow accent-ring dot so a "Coming soon / Work in
  progress" roadmap pins first. Registered in `blocks.ts`, demoed on
  `/kit-blocks`, `blocks.test.ts` vocabulary list extended (6/6 green).
- 2026-09-23 — **Passwordless `/auth` + quiet back line** — the Better Auth
  step machine dropped `password`/`reset-request`/`reset-confirm` (no
  signup UI exists, so the password path was a dead end looping into its
  own reset flow). Chooser is now social → divider → email OTP → magic
  link; `BackButton` is an inline `button.auth-back` (ArrowLeft + label)
  instead of a full-width `.button`. `web-auth-actions` lost
  `signInWithPassword`/`requestPasswordReset`/`resetPassword` and
  `sendVerificationOtp` narrowed to `type:"sign-in"`; i18n dictionaries
  dropped the dead keys (`passwordLabel` stays for the Auth.js
  credentials card — that engine keeps its password form). Mobile
  `index.tsx`/`auth/actions.ts` dropped the password field/wrapper the
  same way. Settings security note reworded (TOTP password check stays —
  it verifies server credentials). Marketing FAQ now says password is an
  API/Auth.js-layer capability, not the shipped UI. Tests green: web
  auth 19/19, mobile 5/5, i18n 6/6; web+mobile+i18n typecheck clean.
- 2026-09-23 — **`ambient-background` kit block added** —
  `src/kit/blocks/marketing/ambient-background.tsx` + module.css render an
  absolute-fill Canvas2D backdrop with five `kind`s (globe particle
  sphere with pointer scatter, rails S-curves with pulses, scrolling
  perspective `grid`, drifting `constellation`, falling-glyph `matrix`).
  Pause/play control (labels via `pauseLabel`/`playLabel` props, English
  defaults — blocks take no kit imports), IntersectionObserver/document-
  hidden gating, DPR caps, static frame under reduced motion. Registered
  in `blocks.ts`, demoed on `/kit-blocks`, covered by `blocks.test.ts`
  (6/6).
- 2026-09-22 — Phases B + C3 landed (all local, uncommitted). **B1** Polar +
  Whop billing adapters (`packages/billing/src/{polar,whop,standard-webhooks}.ts`
  + routes `app/api/billing/webhook/{polar,whop}`): both verify Standard
  Webhooks; Polar via `@polar-sh/sdk` `validateEvent`, Whop via
  `unwrapWebhook`; `BILLING_PROVIDER` += `polar|whop` with per-plan price ids.
  **B2** email: `EmailSdkTransactionalEmailSender` over
  `@opencoredev/email-sdk` (telemetry off) routes postmark/sendgrid/mailgun/
  smtp/brevo; templates reimplemented as React Email components in
  `templates.tsx`. **B3** custom domains: `CUSTOM_DOMAINS_PROVIDER`
  off|local|cloudflare + `workspace_domain` table (migration
  `0005_ambitious_gladiator`), `src/custom-domains/` (hostname validation,
  Cloudflare/local clients, server actions, host resolver with 60s TTL),
  `domain.verified` webhook, `getRequestBrand()` + `ChromeBrand` plumbed
  through the app chrome/auth/metadata on every branded route, dynamic Better
  Auth `trustedOrigins`, Settings → Domains section + i18n ×4. **B4**
  Supabase: `postgresClientOptions` (prepare:false on :6543/pgbouncer/
  `DATABASE_POOLER=transaction`), `STORAGE_REGION`/`STORAGE_FORCE_PATH_STYLE`,
  `scripts/supabase-provision.mjs` + `supabase-doctor.mjs` (`pnpm
  supabase:provision|supabase:doctor`), two deploy guides. **C3**
  `.devin/wiki.json` (30-page DeepWiki steering) + `renderWikiJson` in
  `scripts/subrepos.mjs` emits per-repo scoped buyer-clean wikis.
- 2026-09-23 — `/docs` `<details>` hydration-mismatch FIXED: the disclosures'
  `open` state is natively user-mutable — a `<summary>` click between HTML
  parse and React's hydration attribute diff (cold compile, slow device, or
  e2e automation racing hydration) legitimately diverges from the vdom
  (`open` extra on `.mobileSidebar`, `open` missing on a closed `.navGroup`),
  tripping the dev-only "some attributes…didn't match" warning. Reproduced
  deterministically by holding client JS requests while clicking a summary.
  Fix: `suppressHydrationWarning` on both `<details>` elements in
  `resource-pages.tsx` (same escape hatch already used on `<html>` and the
  palette `<kbd>`) — never emitted to HTML, DOM behavior identical (the
  warning was never patched up anyway; the user's toggle persists).
  Regression: two e2e tests in `resources.spec.ts` hold JS chunks, click
  pre-hydration, assert state preserved + zero hydration console errors.
- 2026-09-22 — Windows fresh-setup friction fixes (outside report): `.env.example`
  `DATABASE_URL` now matches docker-compose (`supastack:supastack` —
  compose's `POSTGRES_*` only applies on first volume init, so the compose
  file stays as-is), and `packages/db/drizzle.config.ts` loads the repo-root
  `.env` via `process.loadEnvFile` (does NOT overwrite existing vars — CI's
  explicit env still wins) with a matching `supastack:supastack` fallback.
  New script split: `typecheck:local` (`--filter=!@supastack/desktop`),
  `typecheck:desktop`, `check:local`, `verify:local` (non-desktop gate, no
  Rust needed), `verify:desktop` (Rust + Tauri prereqs); `check` stays the
  full CI gate incl. `cargo check`. Dev ports pinned: web 3000, docs 3001
  (explicit `--port` fails loudly on collision in Next 16.3.4; Dockerfile
  runs `node server.js` so `start` is unaffected). Playwright: new
  `tests/e2e/global-setup.ts` warms 16 route families through a real browser
  before the parallel run (webServer starts before globalSetup — verified in
  1.62.1), `expect.timeout` 15s + test `timeout` 60s absorb `next dev`
  latency under `fullyParallel`; selector drift fixed (Corner-radius "Soft"
  scoping, exact radio names, exact "Search" button). The stale homepage
  `#architecture`/`[data-story-progress]` half of the FAQ test was removed —
  the section was intentionally deleted in 5b7f058. README gained
  corepack/elevation, verify-gate, port, Docker Postgres, and WSL 2 notes;
  AGENTS.md dev commands updated. `tests/local-setup.test.ts` guards the
  setup contract (env↔compose↔drizzle parity, scripts, ports, Dockerfile).
  Clean-state check: `typecheck:local` passes with `next-env.d.ts` + `.next`
  moved aside — no `next typegen` needed. Result: e2e 8/23 cold → 22/23
  cold; remaining flake is `next dev` slowness under `fullyParallel`×11 with
  concurrent external edits. Open: the
  user's root `.env` still carries `postgres:postgres` (stale, should match
  `.env.example`).
- 2026-09-23 — Session state: all T2–T4 work below is local and
  uncommitted.
- 2026-09-23 — `/auth` card fully localized (T4): the card's hard-coded
  English is gone — `authStepTitle(step, titles)` consumes a localized
  `stepTitles` record and every title/label/button/quiet-note (incl.
  `{email}`/`{provider}`/`{setting}` templates via new `src/format.ts`
  `formatTemplate`/`splitTemplate`) reads `copy`; `authjs-signin.tsx`
  mirrors it. `MessageDictionary["auth"]` gained ~35 keys translated in
  all 4 locales. `web-auth-page.test.ts` has a de password-step
  regression test. Gates: web-auth tests + i18n tests + tsc + eslint +
  prettier clean.
- 2026-09-23 — `/auth` wiring complete (T3): the pending session renders a
  skeleton card built from the kit `Skeleton` block (contrast fixed —
  8% text-mix base + 14% shimmer so it reads on `--raised` cards), every
  auth button gets a fixed 16px `.button-icon` slot with a centered
  `.button-label` (Mail/Link2/KeyRound/ArrowLeft + brand marks from
  `social-provider-marks.tsx`), social providers render first then the
  localized `auth.orDivider`, and all failures/successes route through
  `toast` via `submitAuthAttempt` + `authErrorMessage` (new
  `auth-errors.ts` + tests; `AuthMessage`/inline `.form-error` removed).
  `authjs-signin.tsx` mirrors it with a ref-guarded effect for server-action
  results, and `authjs-actions.ts` now returns machine `AuthJsErrorCode`s.
  `app/auth/page.tsx` resolves `locale` from the cookie/headers and passes
  `copy` (`dictionary.auth`, extended with `orDivider`/`restoring*`/
  `signedIn`/`signedOut`/`passwordUpdated` in all 4 locales) + `locale`;
  `MarketingAccountShell` forwards `locale` to `SiteHeader`.
- 2026-09-22 — OpenRouter + agent frameworks + MCP server. `AI_PROVIDER=
  openrouter` (`OPENROUTER_API_KEY` required; optional `OPENROUTER_APP_NAME`/
  `OPENROUTER_SITE_URL` → X-Title/HTTP-Referer attribution) through
  `OpenRouterProvider` (`@supastack/ai`) and `createOpenRouterClient` in
  server-provider-composition. New `@supastack/agents` package: shared
  tool contract/registry (`defineTool`, scopes read|write, injected
  `ToolContext`), `executeToolCall` wrapper, lazy adapters for ai-sdk
  (default), mastra, langgraph, openai-agents selected by
  `AGENT_FRAMEWORK` → `config.agents.framework`; composed server-side in
  `src/agent-runtime.ts` (no public endpoint — would bypass the
  ModelRouter budget). `sk_` bearer resolution extracted to
  `src/api-key-auth.ts` (`resolveApiKeyCaller`), shared by apiV1Bff and
  the new stateless `POST /api/mcp` MCP endpoint (`src/mcp-server.ts`,
  `WebStandardStreamableHTTPServerTransport`, API-key-only auth,
  scope-filtered tools from `src/workspace-tools.ts` delegating to
  apiV1Bff, shared api-v1 rate limiter, GET/DELETE 405). Docs guides:
  modules/openrouter, modules/agent-frameworks, modules/mcp-server.
- 2026-09-23 — Tooltip app block (T2). New
  `src/kit/blocks/app/tooltip.tsx` + `tooltip.module.css`, registered in
  `KIT_BLOCKS` with a `/kit-blocks` demo: `aria-describedby` on the first
  focusable descendant (wrapper + `tabindex` fallback), 300ms-delayed
  `pointerenter` for mouse/pen only (touch never opens), instant
  `focus-visible` open, Escape/blur/leave close, persistent hidden bubble
  so the description always resolves; caret + reduced-motion-safe
  opacity-only entrance.
- 2026-09-22 — READMEs back to English-only in all 4 repos (user call: US
  buyer audience). Root `README.md` lost the `English | 简体中文` toggle +
  `## 简体中文` mirror; `renderReadme` (`scripts/subrepos.mjs`) lost the same
  generated block; `tests/subrepos.test.ts` now asserts no `\p{Script=Han}`
  in the rendered README. The sibling checkouts were regenerated in place
  via `renderReadme` — uncommitted there; propagates on the next
  `pnpm sync:subrepos` (needs `--force` or a commit first since the
  checkouts are dirty).
- 2026-09-22 — Feature Board (all platforms). Workspace-scoped
  `feature_request` + `feature_request_vote` tables (composite PK
  `(requestId, userId)` on votes; `voteCount` counter-cache mutated in the
  same transaction). Pure logic `src/feature-board.ts` (statuses
  open→under_review→planned→in_progress→shipped|closed, input
  normalization, vote counter). Actions `src/feature-board-actions.ts`:
  `listFeatureRequests` via new `requireWorkspaceViewer` (guests READ,
  `canWrite`/`canManage` flags drive UI), member create/vote via
  `requireWorkspaceWriter`, owner/admin triage + delete via
  `requireWorkspaceManager`. Author auto-votes on submit (Canny-style).
  Routes `/feedback` + `/[locale]/feedback` (`WebFeatureBoardPage`),
  WorkspaceShell nav (Feedback between Commerce and Billing), robots
  disallow. Integrations: audit `feature_request.*`, webhooks
  `feature_request.created`/`status_changed`, GDPR export joins
  (`authoredFeatureRequests`, `featureVotes`). Mobile: BFF
  `src/mobile-feature-board-bff.ts` (framework-free, dep-injected) +
  drizzle wiring `src/mobile-feature-board.ts` +
  `GET|POST /api/mobile/feature-requests` +
  `POST …/[requestId]/vote`; Expo screen `apps/mobile/app/feedback.tsx`
  with `src/feature-board/{client,presentation}.ts` (list, status filter,
  submit, vote) + entry on `app/index.tsx`. Verified: `pnpm check` green —
  lint, typecheck (18 pkgs incl. Tauri cargo), 756 tests, prettier; nav
  contract tests updated for the new link; mobile screen drops the unused
  `createMobileAuthActions` (board only needs `useSession`/`getCookie`).
- 2026-09-22 — Growth modules SHIPPED (waitlist + early-access invites +
  referral attribution). Platform-level (non-workspace) tables
  `waitlist_entry` (email unique, referralCode unique, referredByEntryId,
  referralCount, status waiting→invited→joined), `early_access_code`
  (code unique, optional bound email/entry, redeemedBy/At, expiresAt),
  `referral` (append-only attribution ledger, kind waitlist|signup);
  migration `0004_luxuriant_switch` (after in-flight 0003 feature-board/
  creem). `src/growth/` module: `waitlist.ts` pure logic,
  `growth-cookies.ts` (`?ref=`/`?invite=` → httpOnly `supastack_ref` 30d /
  `supastack_invite` 14d, captured in `proxy.ts` both branches),
  `early-access.ts` (`GrowthStore` seam + validate/redeem orchestration),
  `growth-store.ts` drizzle impl (conditional/幂等 writes),
  `waitlist-service.ts` (join + invite email builders),
  `waitlist-actions.ts` (public join + admin ops), `waitlist-queries.ts`
  (admin read boundary). `packages/auth` gains optional `earlyAccess`
  hooks: `user.validateUserInfo` gate (invite-only mode; admin method +
  ADMIN_EMAILS bypass) + `user.create.after` redemption (code → redeemed,
  entry → joined, `?ref=` → referral row; self-referral skipped); web
  wiring in `auth-runtime.ts`/`auth-server.ts` (dynamic audit import —
  auth-runtime↔audit-runtime 静态环). Admin surface `/admin/waitlist`
  (platform admins): referral-priority listing, per-row + batch invite
  (transactional i18n mail `mail.earlyAccess*` ×4, `workspaceId:"pre-auth"`),
  standalone codes, removal. Landing: `waitlist-band` kit block after hero
  on `/` + `/[locale]` (`?waitlist=`/`position`/`code` echo + share link),
  `nav.waitlist` in header nav, `/kit-blocks` demo. GDPR export `growth`
  section; audit `waitlist.*`/`early_access_code.*`; mail-preview entry.
  Affiliate = referral attribution only; commissions/payouts out of scope.
  Verified: web 514 + db 44 + auth 27 + config 13 + i18n 6 tests green,
  tsc/eslint/prettier clean (`.env.example` excluded from prettier args).
- 2026-09-22 — Creem added as third `BILLING_PROVIDER` (user request:
  lower-fee MoR, easier onboarding than Stripe). New
  `packages/billing/src/creem.ts` adapter sharing the BFF contract —
  `POST /v1/checkouts` (`product_id`/`units`/`request_id`/`metadata`),
  `POST /v1/customers/billing` → `customer_portal_link`, and
  `creem-signature` HMAC-SHA256 verification mapping
  checkout.completed/subscription.*/refund events onto the shared
  entitlement ledger. Config: `CREEM_API_KEY`/`CREEM_PRODUCT_ID`/
  `CREEM_WEBHOOK_SECRET` required; `CREEM_TEST_MODE` selects
  test-api.creem.io; `CREEM_PRODUCT_ID_{PRO,PRO_YEARLY,LIFETIME}` feed
  `productPlanPriceMapFromEnv(env, "creem")`. Webhook route
  `app/api/billing/webhook/creem/route.ts`. Verified: billing/config tests
  + composition offline-webhook test + apps/web suite (462) + tsc green.
- 2026-09-22 — Docs UX improvements: `DocsSideScroll` keeps
  `.sidebar` scrollTop across client-side guide navigation
  (sessionStorage + isomorphic `useLayoutEffect` — the sidebar remounts
  with the page component even under `next/link`), and the search
  palette labels its shortcut per platform (`isAppleDevice()` → `⌘K` /
  `Ctrl K`). Palette `go()` now uses `useRouter().push` and result rows
  are `Link`s. Verified: tsc clean, resources tests 8/8.
- 2026-09-22 — CI green fix: two pre-existing failures that masked each
  other. (a) `security-scan` — `pnpm audit --audit-level=high` flagged
  11 high/critical transitives in the `trigger.dev` toolchain
  (`giget>tar@6.2.1`, `engine.io-client>ws@8.17.1`,
  `@prisma/config>deepmerge-ts@7.1.5`); fixed via scoped `overrides` in
  `pnpm-workspace.yaml` — scoped because Metro (apps/mobile) still needs
  `ws@7`. 4 moderates remain (below the gate). (b) `validate` —
  `@supastack/desktop` `cargo check` died on missing `glib-2.0.pc` ever
  since desktop landed (451c789); `ci.yml` now apt-installs Tauri's
  Linux system deps before `pnpm check`. Also fixed latent typecheck
  breaks in the in-flight Turnstile work (`exactOptionalPropertyTypes`
  on `captchaSiteKey`, untyped `vi.fn` mocks in `captcha.test.ts`) and
  ran `pnpm format` over 18 drifted files. Verified: `pnpm check` +
  `pnpm build` green.
- 2026-09-22 — Bot-protection capability: `CAPTCHA_PROVIDER=off|turnstile` in
  `packages/config` (secret key server-only, site key public via
  `captcha.turnstileSiteKey`), `apps/web/src/captcha.ts` verifier boundary +
  `captcha-widget.tsx` client widget (auto `cf-turnstile-response` input in
  forms; `x-captcha-response` header for auth client calls). Wired into
  contact/newsletter lead actions (`status=captcha` on failure) and the
  better-auth `captcha` plugin in `packages/auth` (`CAPTCHA_ENDPOINTS`
  covers credential + token-issuing endpoints). Off by default — local dev
  stays credential-free.
- 2026-09-22 — Buyer-requirements feature pass (CMS + commerce + visual
  library). New workspace modules: **CMS** at `/content` —
  `content_entry` table (post/page/doc, draft/published/archived,
  slug unique per (workspace, type), `created_by`), `src/content.ts` pure logic +
  `content-actions.ts` (member+ `requireWorkspaceWriter`, new helper in
  `workspace-access.ts`; `listPublishedContentEntries` is the deliberate
  PUBLIC read boundary for public content surfaces (blog etc.) — explicit
  workspaceId, no session); `content.published` webhook; authored entries
  joined into the GDPR export (`data-export.ts`). **Commerce** at
  `/commerce` — `commerce_product`/`commerce_order`/`commerce_order_item`
  tables, `src/commerce.ts` (integer-cents math, forward-only
  pending→paid→fulfilled + cancel/refund lifecycle) +
  `commerce-actions.ts` (owner/admin `requireWorkspaceManager`;
  server-computed totals, optional tracked inventory with decrement +
  restock-on-cancel, active-products-only lines, single-currency orders);
  `commerce.order_created`/`commerce.order_status_changed` webhooks; audit
  actions for both modules. Routes + locale mirrors + WorkspaceShell nav +
  robots disallow for both. Theme library grew: 4 color packs
  (`amethyst`/`volt`/`meadow`/`porcelain` → 16 total) + 4 style bundles
  (`amethyst-lounge`/`volt-lab`/`meadow-notes`/`porcelain-store`). Kit
  blocks: `product-grid` (marketing) + `data-table` (app), registered +
  demoed on `/kit-blocks`. Verified: apps/web 453 tests + tsc green,
  packages/db tests green.
- 2026-09-22 — Issue #2 fixed: `account` gained `issuer` (NOT NULL) and its
  unique key moved to `(issuer, account_id)` per Better Auth 1.7.2's
  `getAuthTables` contract; new idempotent migration `0001_far_luke_cage`
  (`ADD COLUMN IF NOT EXISTS` + NULL-only backfill `local:credential` /
  `local:oauth:<providerId>` + `SET NOT NULL` + index swap) covers all three
  drifted-DB states left by the 6c5d85a baseline squash. Orphan users are NOT
  deleted (magic-link sign-in legitimately creates account-less users).
  Regression guards: `packages/auth/src/drizzle-schema.test.ts` (real
  drizzleAdapter + `getAuthTables` sweep) and gated e2e
  `auth-signup.integration.test.ts` (`TEST_DATABASE_URL`). Verified on docker
  postgres: fresh + drifted migrate paths + real `sign-up/email` 200.
- 2026-09-22 — Toast system + email i18n landed. Toast:
  `apps/web/src/toast.tsx` + `toast.module.css` (dependency-free pub/sub
  store, `useSyncExternalStore`, `<Toaster>` mounted in `app/layout.tsx`,
  dismiss label self-localizes via `LOCALE_COOKIE` → `common.dismiss`),
  plus a new `data-toast-style` axis in `theme/presets.ts`
  (solid/soft/outline — CSS hooks live in `toast.module.css`, NOT
  `app-theme.css`, because the viewport mounts at body level).
  `StyleDefinition.toastStyle` keeps style bundles complete; ThemePicker
  has a radiogroup + live preview button. Email i18n:
  `TransactionalEmail` + `templates.ts` input gained `lang`/`footer`
  (`brandName` too); `HtmlTemplatedEmailSender` forwards them;
  `mail.transactionalFooter` added to all 4 dictionaries; invite/OTP
  builders pass resolved locale through; template is now a 440px
  phone-first card with the footer below it.
- 2026-09-21 — SEO pass over the public surface: new `src/marketing/seo.tsx`
  (server-only `siteOrigin`/`absoluteUrl`, `<JsonLd>` injector with `<`→`\u003c`
  escaping, Organization/WebSite/FAQPage/BlogPosting/BreadcrumbList builders,
  `homeLanguageAlternates`, `ogLocaleFor`). Root layout gained
  `title.template` (`%s | supastack` — page titles went bare), `summary_large_image`
  Twitter card, og:locale alternates, and Organization+WebSite JSON-LD. Every
  indexable page now sets `alternates.canonical`; `/` + `/[locale]` declare
  hreflang (en/de/es/fr + x-default) and per-locale `og:locale`.
  `LocaleHtmlLang` syncs `<html lang>` on localized pages. JSON-LD: FAQPage on
  home + /faq, BlogPosting+Breadcrumb on articles, BreadcrumbList on docs
  guides. `app/sitemap.ts` now emits priority/changeFrequency/lastModified via
  `buildMarketingSitemapEntries`; `app/robots.ts` disallows all app-route
  prefixes incl. `/*/`-localized mirrors. New generated `opengraph-image` routes
  (root + per-post, brand tiles via `ImageResponse`) and `app/manifest.ts`.
  AGENTS.md gained an `## SEO` contract section.
- 2026-09-21 — Firestore lead persistence landed: new
  `apps/web/src/marketing/lead-store.ts` (`LeadStore` boundary, env-selected
  via `MARKETING_LEAD_STORE`: unset → email-notify only, `local` →
  `.data/marketing-leads.json`, `firestore` → `marketing_leads` collection
  via firebase-admin, newsletter dedupe on `newsletter:{email}` doc id,
  contacts always append). `submitLead` gained an optional `store` sink —
  persist-then-notify, duplicate newsletter → ok without re-mailing the
  inbox. `LeadRecord`/`LeadStore` types live in `marketing-leads.ts` (client
  safe); `leads-actions.ts` passes `store: await getLeadStore()`. New envs
  in `.env.example` (`MARKETING_INBOX`, `MARKETING_LEAD_STORE`,
  `FIREBASE_*`, `FIRESTORE_DATABASE`); `.gitignore` + `.data/`; firebase-admin
  13.6.0 dep + allowBuilds for `@firebase/util`/`protobufjs`. Verified:
  611 unit tests + a live integration run against a real Firestore
  (create/duplicate/cleanup clean).
- 2026-09-21 — `/changelog` REMOVED from the kit: a marketing changelog
  belongs to the product built on the kit, not the kit itself.
  Deleted `app/changelog/`, `src/marketing/changelog-*` (entries,
  page, module.css, test), scrubbed `siteConfig.navigation` +
  `MarketingSection`, `SiteHeader` navLabels, `marketing-sitemap`,
  `kit-blocks` demo footer, `nav.changelog` in all 4 dictionaries, and
  mentions in PRODUCT.md + the theme inventory doc. Do not re-add a
  changelog route to this repo.
- 2026-09-21 — Docs nav animation: `/docs`
  sidebar groups are now collapsible `<details open>` folders with chevron
  summaries + hover backgrounds, the mobile "Browse documentation"
  disclosure animates the same way, and a delegated `DocsMotion` client
  enhancer (in `src/resources/docs-tools.tsx`, mounted once in `.docsMain`)
  runs WAAPI height+opacity on each summary's next sibling —
  reduced-motion/no-WAAPI/no-JS all fall back to native toggling. CSS in
  `resources.module.css` (`.navTree`/`.navGroup summary`/`.groupChevron`/
  `.navItems` rail + pill hovers). See `.ai/apps/web/src/resources/*.md`.
- 2026-09-21 — Repos moved to a dedicated GitHub org — local `origin`
  remotes on the monorepo + all three sibling checkouts were repointed;
  the previous org's `github.com` URLs redirect.
  `deriveRemote`/`github.repository_owner` pick the org up automatically.
  READMEs are now bilingual in all 4 repos: root README got
  an `English | 简体中文` toggle + `## 简体中文` mirror; `renderReadme`
  (`scripts/subrepos.mjs`) generates the same structure for sub-repos;
  pushed via `pnpm sync:subrepos`. (Reverted 2026-09-22 — English-only.)
- 2026-09-20 — Issue #1 (Windows CRLF vs Prettier): added `.gitattributes`
  (`* text=auto eol=lf` + binary markers, `*.bat`/`*.cmd` stay CRLF),
  renormalized 3 CRLF index blobs (`.env.example`, `.gitignore`,
  `.prettierignore`) + 13 CRLF working files, shipped `.gitattributes` via
  `ROOT_FILES` into sub-repos, README "Windows notes" (LF pin + longpaths).
- 2026-09-20 — `apps/desktop` landed: Tauri 2 webview shell loading the web app
  (`SUPASTACK_APP_URL`), Rust tray + `CmdOrCtrl+Shift+Space` hotkey +
  close-to-tray + single-instance (`src-tauri/src/lib.rs`). Sub-repo sync:
  `scripts/subrepos.mjs` (dep-closure + manifest, tested in
  `tests/subrepos.test.ts`) + `scripts/sync-subrepos.mjs` mirror CLI wired to
  `pnpm sync:subrepos`, `.githooks/pre-push`, and `.github/workflows/subrepo-sync.yml`
  (needs `SUBREPO_SYNC_TOKEN` secret). Sync targets the real sibling
  checkouts (`checkout` in `subrepos.json`;
  `SUBREPO_HOME` env or `.subrepos/` managed clones as fallback for CI),
  pushing each checkout's own `origin`; sibling guards refuse to touch dirty
  or foreign-commit checkouts (`--force` overrides). Synced content is
  buyer-facing (forks): manifest is filtered through `git check-ignore` on both
  sides (`.env`/`.impeccable` never leave), staging is pathspec-limited, and
  AGENTS.md/.env.example/README render without monorepo-internal sync machinery.
  Verified: cargo check+test green, sync e2e against local bare repos +
  real GitHub pushes to all three remotes.
- Open: seat-count stepper work in `apps/web/src/seat-count*` is a separate
  in-flight change — keep it out of desktop/sync commits.
- 2026-09-20 — `/billing` Seats field is now a −/editable/+ stepper:
  type-to-edit input, live apply for valid
  counts, blur/Enter commits, Escape reverts, bounds 1–999. Helpers in
  `src/seat-count.ts` (`sanitizeSeatInput`, `parseSeatInput`,
  `clampSeatCount`); styles `.seat-stepper` in `app/globals.css`.
- 2026-09-19 — Added two marketing kit blocks:
  `feature-spotlight` (media panel + focused copy + container-less mini
  points — the "coded container, not text cards" section pattern) and
  `scroll-reveal` (`<ScrollReveal>` once-only IntersectionObserver entrance;
  hidden state gated by `(scripting: enabled)` + `prefers-reduced-motion:
  no-preference` so it always fails open). Registered in `blocks.ts`,
  demoed on `/kit-blocks`, contract-tested in `blocks.test.ts`.

## NEVER Change

- All demo surfaces use neutral, replaceable sample content. The public landing
  has no customer quotes, portraits, trust counts, or setup-time claims. Remove
  stale customer proof from assets, translations, comments, tests, and memory.
- Kit blocks are token-only, self-contained `.tsx` + `.module.css` pairs —
  copyable with zero edits beyond props/copy.
- Motion fails open: hidden states must require scripting + full motion.
- Desktop stays a webview shell — product UI/auth/chat live only in `apps/web`.
- Sub-repos are generated mirrors; edits happen in this monorepo only.

- 2026-09-22 — `/auth` card fix: the
  `auth-card auth-form` combo let `.app-theme .auth-form { width:100% }`
  override the card's `min(100%,480px)` cap at equal specificity, so the
  sign-in card stretched full-width under the fixed header. Fixed in
  `app-theme.css` (`.auth-card.auth-form` cap + `.auth-stage .auth-card`
  420px compact card, header-aware `min-height:100dvh`, reduced-motion-safe
  `auth-card-enter`); `authjs-signin.tsx` article wrapped in
  `<main className="auth-stage" id="main">`.
- 2026-09-23 (T4): `/auth` card fully localized — `web-auth-steps.ts`
  `authStepTitle` now takes the locale-resolved `auth.stepTitles` record
  (hard-coded English table removed), and every string in
  `web-auth-page.tsx`/`authjs-signin.tsx` reads `copy` (new `format.ts`
  `formatTemplate`/`splitTemplate` render `{email}`/`{provider}`/`{setting}`
  placeholders). `MessageDictionary["auth"]` gained ~35 keys in all 4
  locales.

Release repair: Next.js 16.3.6 and scoped transitive patches pass the high/critical audit gate. Full local check passed (19 typechecks including Rust, 1,693 tests, lint, formatting); full-history Gitleaks passed. The owner-approved Actions sync secret is configured for all three platform targets. Keep audit checks and buyer package boundaries intact.

2026-10-12 navigation refinement complete locally: public desktop navigation vertically centered; active header links use color with no underline, including resource pages. Two desktop/mobile browser cases, utility CSS contract tests and scoped lint/format pass. Pre-existing work preserved; no publish or commit.
