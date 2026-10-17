# apps/web/src/resources/additional-guides.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Long-tail docs guides appended into `guides` (content.ts) → docs routes +
marketing sitemap. `guide(slug, tab, group, title, description, setup, code,
workflow, checks)` builds the three-section Guide shape.

## Important Notes / NEVER Change

- Demo branding is text-only. Guidance points to the generic social preview
  and product-owned customization rather than preserving built-in artwork.

- `web/adopt-patterns` and `web/upgrading` give discoverable public summaries;
  detailed recipes live in `docs/adopt-patterns.md` and `docs/upgrading.md`.
  The testing guide records bounded Windows Defender first-run diagnosis and
  `PLAYWRIGHT_PORT` for occupied local E2E ports.
- `web/upgrading` must stay org-neutral: the upstream remote is the generic
  `upstream` and its URL is the `<org>/supastack-web.git` placeholder pattern
  (matching `docs/upgrading.md`), never a real org name — the guide ships
  verbatim into every buyer checkout. `tests/ai-docs.test.ts` scans this
  whole `src/resources/**` tree for private-org or maintainer-only
  vocabulary leaks.
- Slugs are `<tab>/<name>` and must stay unique (content test asserts).
- 2026-09-23 additions under "AI and operations": `modules/openrouter`,
  `modules/agent-frameworks`, `modules/mcp-server` — the MCP guide carries the
  canonical `mcpServers` client-config snippet for `/api/mcp`. 2026-10-03:
  `modules/agent-frameworks` workflow gained the budgeted-agent paragraphs —
  `runBudgetedAgent`/`getAgentRunRuntime().runAgent` as the ModelRouter-budget
  path plus the `createWorkspaceTools` worked example — and checks gained the
  offline `agent-budget.test.ts` exercise paragraph. Later same day: += a
  BYOK/platform-key paragraph (agent runs bill the platform key, BYOK
  workspaces reject up front, tools-capability early failure).
- 2026-09-22 additions: `modules/custom-domains` (Cloudflare for SaaS),
  `deploy/supabase-cloud`, `deploy/supabase-self-hosted`.
- 2026-09-26 additions: `deploy/coolify-vps` (single-VPS Coolify self-hosting —
  build-on-box vs prebuilt-image sizing, scheduled-task tick; pairs with
  `docs/vps-coolify.md`).
- 2026-09-26 addition: `modules/billing-custom-adapter` under "Identity and
  access" (custom `BILLING_PROVIDER` recipe — six touchpoints; pairs with
  `docs/custom-billing-adapter.md`).
- 2026-09-27 addition: `modules/scheduled-digest` under "AI and operations"
  (the `email.digest` workspace job — schedule setup, tick path,
  `job_schedule.input` for type/lookback filters — no public API accepts a
  schedule payload, so server-side upsert or a product-added route;
  `[<key> tier]` gated markers; recipient fan-out capped at 100;
  `registerJobHandler` extension point). 2026-10-02: gained the missed-run
  paragraph — a down app/ticker dispatches one late run on recovery and
  `missed_runs` counts the skipped occurrences; the Cron schedules list
  shows the total (a sleeping laptop shows missed runs after waking).
- 2026-09-27: `modules/billing-configuration` workflow gained the
  vocabulary-bridge paragraph — `ProductPlan.entitlement`
  (`ai.reference-task` on pro/lifetime) is the same key a CMS
  `required_entitlement` field and `EntitlementGate`'s `entitlementKey`
  equality-compare against.
- 2026-09-28 additions: `mobile/in-app-purchases` (PurchasesProvider seam —
  RevenueCat adapter + fake, paywall reducer drives UI), `web/kit-blocks`
  (block library surfaces + registration + /kit-blocks dev browser),
  `modules/public-api` (`/api/v1` + sk_ scopes + OpenAPI route),
  `web/seo-public-pages` (metadata → canonical → sitemap → JSON-LD
  checklist). `mobile/builds` checks gained a pointer to
  `mobile/store-submission`.

## Change History

2026-10-13: i18n guide copy now lists `/ai` among locale-prefixed app routes (the AI-task console) and spot-checks Settings/org/ai/billing/chat headings; `/dashboard` remains analytics-only.

2026-10-01: corrected organizations guide to describe the shipped platform-admin role, bans and impersonation, alongside owner/admin/member workspace roles.

| Date       | Change                                                                                                                                               | Author |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-10-06 | `web/upgrading` de-privatized: hardcoded private-org monorepo URL + fixed remote name → generic `upstream` remote with `https://github.com/<org>/supastack-web.git` placeholder and "repository you forked or purchased" phrasing; beginner setup/troubleshooting notes use `upstream`; de/es/fr copies retranslated in `core.*.json` + `beginners.*.json` | Devin  |
| 2026-10-03 | `modules/agent-frameworks` += BYOK/platform-key + tools-capability paragraph; de/es/fr keys in `beginners.*.json` | Devin  |
| 2026-10-03 | `modules/agent-frameworks` += budgeted agent-run paragraphs (`runBudgetedAgent`, `runAgent` worked example, offline-test check); de/es/fr keys in `beginners.*.json` | Devin  |
| 2026-10-02 | `modules/scheduled-digest` += missed-run recovery paragraph (`missed_runs` counter; Cron schedules list total); de/es/fr keys added in `beginners.*.json` | Devin  |
| 2026-09-28 | +4 guides (`mobile/in-app-purchases`, `web/kit-blocks`, `modules/public-api`, `web/seo-public-pages`); `mobile/builds` cross-links store submission | Devin  |
| 2026-09-27 | Added adoption and upgrade guide summaries plus first-run Windows browser-test troubleshooting | Codex |
| 2026-09-27 | `modules/billing-configuration` += entitlement-key bridge paragraph (plan `entitlement` ↔ CMS `required_entitlement` ↔ `EntitlementGate`)             | Devin  |
| 2026-09-27 | +`modules/scheduled-digest` guide ("AI and operations") — `email.digest` workspace schedule, tick path, `job_schedule.input` filters                 | Devin  |
| 2026-09-27 | `modules/scheduled-digest` wording fix — no public API accepts schedule input (server-side upsert or product-added route); +recipient cap / opt-out notes | Devin  |
| 2026-09-26 | +`modules/billing-custom-adapter` guide (custom BILLING_PROVIDER recipe; pairs with `docs/custom-billing-adapter.md`)                                | Devin  |
| 2026-09-26 | `deploy/coolify-vps` code block: tick command now a single uncommented line — a #-commented wrap would no-op (exit 0) inside Coolify scheduled tasks | Devin  |
| 2026-09-26 | +`deploy/coolify-vps` guide (VPS + Coolify self-hosting path)                                                                                        | Devin  |
| 2026-09-25 | `modules/billing-configuration` env/endpoint lists extended to polar/whop/paddle/dodo/paypal                                                         | Devin  |
| 2026-09-22 | Custom domains + Supabase Cloud/self-hosted guides                                                                                                   | Devin  |
| 2026-09-23 | OpenRouter, Agent frameworks, MCP server guides                                                                                                      | Devin  |

## Planned Changes

- Rewrite every guide in `additional-guides.ts` for readers with no programming background, preserving every published slug and section ID while adding numbered actions, exact repository paths and commands, expected outcomes, and likely recovery steps. Leave `mobile/local-setup` to the coordinated first-run-guide edit.
- Add exact-source-string German, Spanish, and French dictionaries in `translations/beginners.{de,es,fr}.json`; the root coordinator will merge those files in `docs-i18n.ts`.
- Link beginner guides to `/docs/web/before-you-start` and `/docs/web/terminal-basics`, which the root coordinator is adding.
- `mobile/local-setup` is the first-run Expo tutorial, with API reachability, Expo preview, and an explicit EAS native-purchase acceptance boundary.
- `mobile/in-app-purchases` documents public RevenueCat client keys, server-only verification secrets, workspace-scoped sync, manager access, webhook verification, and sandbox/device testing.
- Purchase recovery directs users to restore after server-sync failure to avoid a duplicate charge. Real native purchase acceptance uses EAS development builds; Expo Go/export is preview only.
- `mobile/builds` distinguishes the workspace export from EAS-native StoreKit/Play Billing verification.

## 2026-10-02 integration

Beginner prose and commands are implemented. New locale strings are consolidated in the three beginners maps after the original dictionaries; preserve command/URL/path identifiers. Native release instructions use filtered Desktop package commands. Verification and mirrors remain local.
