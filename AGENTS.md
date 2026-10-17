# supastack Agent Guide

## Non-negotiable boundaries

- Default demo chrome is text-only. Do not ship proprietary logo artwork,
  customer portraits, real testimonials, trust counts, or production marketing
  copy in any platform demo. Keep commit messages, comments, translations,
  metadata, and documentation generic. Native packaging uses blank icon
  placeholders; product builders supply their own assets.

- NEVER merge, push, deploy, or release to production without the user's
  explicit consent for that specific action — no commits to main/master,
  no `gh pr merge`, no deploys or publishes, no paid/billing-affecting
  calls. Stop and ask first; work stays local unless told otherwise.
  `pnpm sync:subrepos` pushes count as publishes — they update the sub-repos.
- Read `.ai/PROJECT_CONTEXT.md` before code changes and maintain matching `.ai/` file docs.
- `llms.txt` at the repo root is the agent entry map (llmstxt.org format): `docs/agent-setup.md` is the unattended setup+deploy runbook (Docker/Podman local, Coolify/plain-Docker VPS), `prompts/agent-setup.md` the pasteable driver prompt. Keep `llms.txt` links honest when adding docs/prompts — `tests/llms-txt.test.ts` fails on a dead target, and every sub-repo gets its own generated `llms.txt` via `renderLlmsTxt`.
- `.ai/` mirror docs describe this repo only — never reference other repositories, private products, or maintainer-only checkouts.
- Use test-first development for behavior.
- Scope every user-owned record by `workspaceId`.
- Keep provider secrets server-only and redact them from logs.
- Keep transactional email separate from outreach.
- `JobRunner` only promises enqueue, status, and cancel. Trigger.dev workflow semantics are explicit. Recurring work lives in `job_schedule` rows claimed by `createDrizzleJobScheduler.claimDueSchedules` (FOR UPDATE SKIP LOCKED, claim-then-advance); `POST /api/internal/scheduler-tick` ticks locally/CI, the `scheduler.tick` Trigger.dev cron ticks under `JOB_PROVIDER=trigger`. Occurrences skipped while no tick ran accumulate in `job_schedule.missed_runs` (claim-time delta; the Cron schedules settings list shows the total). `email.digest` (`apps/web/src/digest-job.ts`) is the shipped workspace-schedule example — a weekly content digest emailed to workspace members; see `modules/scheduled-digest` in the docs guides. The `push.receipts` platform schedule (`apps/web/src/push-receipts.ts`) reconciles Expo push tickets every 30 minutes and prunes device tokens that report `DeviceNotRegistered`.
- Mobile never exposes Stripe Checkout before RevenueCat exists. Mobile caches recent reads on-device under `apps/mobile/src/offline` (`expo-file-system`), scoped per `${userId}:${workspaceId}` and cleared on sign-out — the cache is a network-error fallback only; auth/permission errors never serve stale data.
- Owners and admins can download a full workspace data export at `GET /api/workspace/export` (Settings → General card). `src/workspace-export.ts` keeps every select list explicit so secret/hash/token columns can never serialize — never widen it to wildcard selects.
- Keep the buyer-facing template free of seller storefront machinery (license checkout, order/license records, repository-delivery automation).
- **supastack is a boilerplate demo.** Web (Next.js), mobile (Expo), and desktop (the shared Tauri webview) must ship neutral, replaceable example content. Never copy any product's actual headline, tagline, promotional sentences, testimonials, customer names/handles/profile links, portraits/avatars, founder/customer counts, setup-time estimates, benchmarks, or sales claims into this repository. Permission to publish customer feedback for another product does not authorize it in the boilerplate. Remove this material from source, translations, public assets, metadata, comments, tests, and shipped docs rather than merely hiding it. Demo pricing/data must be explicitly labeled illustrative; reusable testimonial blocks may remain with clearly fictional examples in the dev-only block gallery, but the default landing page must have no testimonials, ratings, customer avatars, or trust counts. Check the shared web surface and every platform export when changing demo content; never import production marketing copy to fill an empty section.
- The seller's actual Starter Kit / S Kit sales site is separate from this demo; its marketing copy, customer proof, and business metrics must never ship in the boilerplate.
- Sub-repos (`supastack-web` / `supastack-mobile` / `supastack-desktop`, declared in `scripts/subrepos.json`) are sync targets only — always edit in this monorepo and push via `pnpm sync:subrepos`. Their names are a fulfillment contract: the seller site invites buyers to exactly these repos, and buyers fork them to build products — synced content must stay buyer-clean (no seller-internal scripts or sync machinery; `.ai/` mirror docs DO ship, but only mirrors of shipped files, with seller-internal lines stripped by the sync renderer). Curated `docs/*.md` + `prompts/` ship via `extraPaths` in `scripts/subrepos.json`, and `mirror()` writes each repo a generated `llms.txt` scoped to what actually ships.
- Desktop (`apps/desktop`) is a Tauri webview shell over the web app — it never forks product UI, auth, or chat logic; window/tray/global-hotkey/single-instance behavior lives in Rust (`src-tauri/src/lib.rs`). `SUPASTACK_APP_URL` (runtime env, then compile-time) selects the backend; `SUPASTACK_DESKTOP_HOTKEY` overrides the `CmdOrCtrl+Shift+Space` summon shortcut. Signed updates support an optional `{{channel}}` placeholder in the endpoint for stable/beta feeds; `SUPASTACK_UPDATE_CHANNEL` overrides a user's chosen channel for the run (Beta Updates menu item).

## Default visual skills

- For frontend design, refinement, and visual fixes, use `impeccable` and `better-interface` by default. Read their installed `SKILL.md` files and relevant references before implementation. Do not install duplicate copies when they are already available.
- `better-interface` coordinates `better-accessibility`, `better-layout`, `better-writing`, `better-typography`, `better-colors`, and `better-ui`. Use each owning skill for its domain, then consolidate the findings and implement fixes within the user's requested scope.
- Wider design skill set — reach for these by domain instead of guessing: `frontend-design` for new UI aesthetic direction, `premium-frontend-ui` for high-end motion/typography work, `optical-ui-design` when drawing or tuning icons/logos/marks, `web-design-guidelines` for UI/accessibility audits, and `data-visualization` for charts and dashboards.
- Use Impeccable's appropriate workflow, especially `animate` for purposeful motion, `polish` for finishing, and `audit` for technical review. Run its context script, inspect the existing interface, and perform bounded desktop/mobile browser verification. Record unverified areas honestly.
- `interface-review`, `explain-interface`, `break`, and `variant` remain user-invoked workflows; do not automatically run every command in a pasted skill catalog.
- Preserve explicit user choices over generic skill preferences. Default demo chrome is text-only: ship no built-in logo artwork, real product marks, or instructions to preserve them. Blank native icon placeholders exist only because OS packaging requires icon files; replace them with your own assets when building a product. Keep the existing black demo theme, typography, accessibility, and reduced-motion support.
- Motion must explain hierarchy, state, or product relationships. For the homepage, use a brief authored entrance on refresh and responsive interaction feedback. No arbitrary traveling tiles, repeated section reveals, fake demo interfaces, or video-player placeholders. Future footage is a continuous muted background layer.
- Maintain reduced-motion, keyboard, narrow-screen, and no-JavaScript usability. Do not hide essential content permanently behind animation or add dependencies for effects the existing stack supports.

## Themes, layouts & product customization

The kit is a foundation, not a fixed look — it ships a **library** (styles, blocks, prompts) plus the axes below. When a user asks an agent to scaffold or restyle a product, pick deliberately (or ask) instead of silently shipping the kit defaults.

- **Design styles** — change `DEFAULT_STYLE_ID` in `apps/web/src/theme/styles.ts` to select the product's default look in one line. Server rendering and pre-paint startup apply its color pack, density, radius, font, layout, and toast style. Explicit saved visitor choices override defaults. `STYLE_CATALOG` is the library, `applyStyle` selects a bundle at runtime, and ThemePicker previews styles under _Design style_. Add styles by appending `StyleDefinition`s.
- **Block library** — `apps/web/src/kit/blocks/` holds copyable, token-only UI blocks registered in `src/kit/blocks.ts` across three surfaces: `marketing` (heroes, feature rows, logo strip, testimonials, FAQ, pricing, newsletter, CTA, chart-line sparkline), `app` (stat grid, empty state, paywall-gate, data-viz bars/donut/metric-trend), and `chrome` (site-header, site-footer, prose-page — the public-site shell + legal scaffold). Compose product pages from blocks instead of inventing section patterns; when a needed block doesn't exist, write it in the same token-only style and register it. Dev-only `/kit-blocks` browses the set live. The kit's own branded chrome lives in `src/marketing/` wired to `siteConfig` — blocks are the generic copyable versions. A second marketing family — the **minimal set** (`product-frame`, `hero-product`, `steps-ruled`, `feature-story`, `comparison-ruled`, `pricing-panel`, `faq-split`, `cta-form`) — implements the `minimal` pack / `minimal-product` style grammar: white paper, hairline-ruled structure, pill actions, the product frame as the only elevated surface. Below-fold marketing sections may opt into the `scroll-reveal` block — a once-only, `prefers-reduced-motion`-gated entrance that fails open (no-JS and non-supporting browsers always see content); never repeating reveals.
- **Prompt library** — `prompts/` at the repo root holds ready agent prompts (pick a style, new landing page, new app screen, re-theme, UI audit). Point users at them when they ask "how do I get the agent to…".
- **Color packs** — `THEME_CATALOG` in `apps/web/src/theme/catalog.ts` ships 12+ packs applied via `html[data-theme]` and persisted per visitor (localStorage + cookie, boot script in `theme-boot.ts`). Packs also paint subtree wrappers (`[data-theme]` on any element), so a page or section can pin a different pack than the global pick. Add a pack by appending a `ThemeDefinition` (all `THEME_TOKEN_NAMES`, `colorScheme`); `contrast.test.ts` enforces legibility.
- **UI presets** — `apps/web/src/theme/presets.ts` adds visitor axes on `<html>`: `data-density` (comfortable/compact), `data-radius` (soft/sharp/round), `data-font` (editorial/geometric/monospace). CSS hooks live in `app-theme.css` as `html[data-x] .app-theme` rules.
- **App layouts** — `data-layout` axis with `sidebar` (default), `topnav`, `focused`, and `collapsible`. `ShellNavigation` enhances the server-rendered rail into a compact modal drawer on phones and in focused mode; collapsible mode adds a persisted desktop icon rail. Shared framing rules live in `app-theme.css`. Add a new shell by extending `LAYOUT_CATALOG`, `ShellNavigation`, and matching `html[data-layout="<id>"] .app-theme` rules. Preserve navigation, workspace switching, and account access in every mode.
- **Marketing theme** — `MARKETING_THEME_MODE` in `apps/web/src/theme/marketing-theme.ts`: `"inherit"` (default — follows the configured style and visitor choices), `"locked"` (explicit black palette), or a pack id (e.g. `"paper"`) pinned on the marketing wrapper. A one-line `DEFAULT_STYLE_ID` change affects marketing and app surfaces unless a product deliberately overrides marketing mode.
- **Preview surfaces** — Settings → Appearance (`ThemePicker`) previews styles and every axis; `/kit-blocks` (dev-only) browses the block library. Keep both working when adding packs/presets/layouts/styles/blocks.
- **Cross-device appearance sync** — signed-in users get the whole appearance bundle (pack, presets, layout, style) persisted per user in `user_appearance` and synced through `GET/PUT /api/account/appearance` (web) and `GET/PUT /api/mobile/appearance`; mobile also offers a "Match web app" synced mode backed by a cached palette. localStorage/cookie stay authoritative for boot rendering; server copies merge by timestamp.
- Products may compose page-level layouts freely; the axes above control chrome, not page composition. A product's own sections live in its components/CSS modules — the starter must never force one hero/nav structure.

## Forms & controls

- Dropdowns/selects must NEVER ship the browser's native popup as the
  interactive surface — the requirement is a smooth, themed menu matching the
  product's control language. Keep a real `<select>` (or hidden input) for
  form semantics/no-JS, and layer a styled trigger + option menu on top with
  full keyboard support (arrows/Home/End, Esc refocus, outside-pointer close)
  and `prefers-reduced-motion`-safe animation. Reuse or extend the existing
  picker/menu component rather than hand-rolling one per screen.

## Icons

- Default icon source is `lucide-react` (installed in `apps/web`). Reach for it first for UI glyphs, feature markers, and status icons.
- Never ship hand-drawn placeholder glyphs, letter/number-in-circle stand-ins, or emoji where an icon is meant — if lucide lacks the mark, design a real SVG with `optical-ui-design` instead of improvising.
- Decorative icons get `aria-hidden`; meaningful ones get an accessible label. Size via props/`size`, color via `currentColor` so icons inherit theme tokens.

## SEO

The agent owns search visibility for the public (marketing/docs/blog) surface. When adding, renaming, or removing public routes, keep every layer below in sync — use the `seo` skill for audits.

- **Metadata** — every indexable route exports `metadata`/`generateMetadata` with a unique `title` + `description`. The root layout's `title.template` appends `| supastack`, so page titles stay bare ("FAQ", not "FAQ | supastack"); use `title.absolute` only when the title already carries the brand (homepages). Keep titles ≲60 chars, descriptions 150–160 chars.
- **Canonicals & hreflang** — every indexable page sets `alternates.canonical` (query/filter variants collapse to the canonical path). Locale-prefixed pages set `alternates.languages` + `x-default` via `homeLanguageAlternates()` in `src/marketing/seo.tsx`.
- **Sitemap & robots** — `app/sitemap.ts` renders `buildMarketingSitemapEntries()` (path + priority + changeFrequency + lastModified); keep `marketingStaticPaths`/`STATIC_ENTRY_META` in `src/marketing/marketing-sitemap.ts` current and extend `marketing-sitemap.test.ts`. `app/robots.ts` must disallow every app/authenticated route prefix, including `/*/`-localized mirrors; public routes never appear in the disallow list.
- **Agent index** — `app/llms.txt/route.ts` serves the llmstxt.org index built by `buildLlmsTxt()` in `src/marketing/llms-txt.ts` (Docs = guides grouped by `DOC_GROUPS`, Pages = `marketingStaticPaths` + `STATIC_PAGE_INFO`, Reference = public endpoints). It stays `force-dynamic` for the same runtime-`APP_URL` reason as the sitemap; keep page/guide sources current instead of hardcoding entries.
- **Structured data** — JSON-LD builders + the `<JsonLd>` injector live in `src/marketing/seo.tsx` (server-only; `<` is escaped). Render schema from the component that shows the content: Organization+WebSite in the root layout, FAQPage where the FAQ renders, BlogPosting+BreadcrumbList on articles, BreadcrumbList on docs guides. Never hand-write raw `<script>` tags for schema.
- **Social cards** — the shared card lives at `apps/web/public/demo-social.png`; `src/marketing/seo.tsx` owns its URL, dimensions, and alt text. When rebranding, replace the PNG and update those fields together. Set `openGraph.images` and `twitter.images` explicitly in the root layout and in any page that defines its own social metadata (Next replaces the layout's whole object). Use `pageSocialMetadata()` for page overrides. `blog/[slug]/opengraph-image.tsx` is the per-article generated-card exception; preserve its `next/og` route and update its branding separately. Keep `twitter.card` as `summary_large_image`. After deployment, fetch the page HTML and image as `Twitterbot` and check that both image tags resolve to a public `200 image/png` response.
- **App surface** — authenticated routes (`/dashboard`, `/settings`, `/billing`, `/chat`, `/admin`, onboarding/invite/org flows) stay noindex-by-omission: absent from the sitemap and disallowed in robots. Dev-gated routes (`/kit-blocks`, `/mail-preview`) 404 in production.
- **Checklist for new public pages** — unique title/description → canonical → sitemap entry (+ test) → JSON-LD if a schema type fits → heading hierarchy + image alts → run the `seo` skill audit.

## AI providers, agents & MCP

- `AI_PROVIDER` selects the platform provider: `fake` (default, deterministic),
  `openai`, `anthropic`, `openai-compatible`, or `openrouter` (requires
  `OPENROUTER_API_KEY`; optional `OPENROUTER_APP_NAME`/`OPENROUTER_SITE_URL`
  send the `X-Title`/`HTTP-Referer` attribution headers). Provider secrets stay
  server-only; model IDs and prices come from the DB catalog — never seed them.
- `AGENT_FRAMEWORK` picks the agent adapter in `@supastack/agents`:
  `ai-sdk` (default), `mastra`, `langgraph`, or `openai-agents`. Adapters load
  lazily; `src/agent-runtime.ts` composes the model source per provider.
- Workspace tools are defined once with `defineTool` in
  `src/workspace-tools.ts` and exposed to both agent runners and `POST /api/mcp`.
  Every tool declares a `read` or `write` scope; callers inject `ToolContext`
  (`workspaceId`/`userId`/scopes) — the model can never choose a workspace.
- `/api/mcp` is a stateless Streamable HTTP MCP server: `sk_` API keys only
  (no cookie sessions, `401` + `WWW-Authenticate: Bearer`), tools filtered by
  key scopes, same `/api/v1` rate limiter, GET/DELETE → 405. Agent runs have no
  public endpoint — they would bypass the ModelRouter budget.

## Billing, email, domains & deployment

- `BILLING_PROVIDER` selects the adapter in `packages/billing`: `local`,
  `stripe`, `lemonsqueezy`, `creem`, `polar`, `whop`, `paddle`, `dodo`, or
  `paypal`. All adapters share one BFF contract (`createCheckoutSession`/
  `createPortalSession`/`verifySignedWebhook`) and write to the same
  entitlement ledger — webhook secrets and API keys stay server-only,
  receivers live under
  `app/api/billing/webhook/<provider>/`.
- `EMAIL_PROVIDER`: `local`, `resend`, `ses`, or the `@opencoredev/email-sdk`
  transports `postmark`, `sendgrid`, `mailgun`, `smtp`, `brevo` (telemetry
  disabled in every path). Templates are React Email components; transactional
  mail stays separate from outreach.
- `ANALYTICS_PROVIDER` selects product/marketing analytics: `off` (default),
  `local`, `plausible`, or `posthog`. `local` mounts a consent-gated
  first-party beacon on the marketing surface → `POST /api/analytics/collect`
  → `analytics_event` rows (nullable `workspace_id`; `visitor_hash` is a
  daily-rotating salted digest — raw IP/user-agent are never stored), with a
  30-day summary card on the admin overview. The script providers inject
  their tag only after consent and require `ANALYTICS_SITE_ID`;
  `ANALYTICS_HOST` optionally overrides the vendor origin.
- `CUSTOM_DOMAINS_PROVIDER`: `off` (default), `local`, or `cloudflare`
  (Cloudflare for SaaS custom hostnames). `workspace_domain` rows stay scoped
  by `workspaceId`; active hostnames become per-request Better Auth trusted
  origins and brand the app chrome via `getRequestBrand()`. Owner/admin manage
  them under Settings → Domains.
- `/setup` is the in-app readiness checklist — open in development,
  admin-only in production. `apps/web/src/setup-readiness.ts` evaluates
  what is configured, what runs in demo mode, and what blocks production;
  add product checks there (the collector lives in
  `setup-readiness-runtime.ts`).
- Settings → Usage is the owner/admin usage-controls surface: a monthly AI
  budget (`workspace_ai_policy`) plus per-meter caps. `USAGE_METERS` in
  `apps/web/src/usage-meters.ts` is where products register meters; caps
  are hard ceilings on top of plan allowances and prepaid credits only
  cover usage above the plan allowance.
- Supabase (managed or self-hosted Postgres + S3): transaction poolers
  (:6543, `pgbouncer=true`, `DATABASE_POOLER=transaction`) get
  `prepare: false` automatically via `postgresClientOptions`. Kit auth is
  Better Auth — Supabase supplies Postgres and S3 storage only.
- Supabase helper scripts ship only in the web sub-repo manifest, so this line drops from synced AGENTS.md copies: `pnpm supabase:provision` creates a cloud project via the Management API (dry-run without `--yes`; never prints secrets), and `pnpm supabase:doctor [--fix-rls]` audits SSL, pooler mode, pending migrations, and PostgREST-exposed tables.

## Development commands

- `pnpm dev` — run development workspaces (excludes `@supastack/desktop` in the monorepo).
- `pnpm check` — lint, typecheck, tests, and formatting in one gate (repos that ship no test suite run it without the test step; typecheck covers `cargo check` where `apps/desktop` ships).
- `pnpm check:local` — the fast local gate: lint, `typecheck:local`, tests where a suite ships, and formatting (no Rust toolchain needed).
- `pnpm build` — production builds (excludes `@supastack/desktop` in the monorepo).
- `pnpm jobs:tick` — fire one scheduler tick against a running app (`scripts/scheduler-tick.mjs`; needs `SCHEDULER_TICK_SECRET` in env/`.env`, `APP_URL`/`SCHEDULER_TICK_URL` for non-:3000 targets). In dev the `POST /api/internal/scheduler-tick` endpoint is the ticker; production `JOB_PROVIDER=trigger` uses the `scheduler.tick` cron task.
- `pnpm test` — deterministic fake/local unit tests; manifests emit `test` only where a suite ships (the desktop sync target has none), so this mention is sub-repo-scoped.
- `pnpm dev:desktop` — web + Tauri desktop shell together; `pnpm verify:local` — `check:local` plus production builds and both Playwright suites; `pnpm verify:desktop` — desktop typecheck/tests/`tauri build`; `pnpm build:desktop`, `pnpm typecheck:desktop`, `pnpm test:e2e`, `pnpm test:e2e:production`, `pnpm smoke:providers` — monorepo-only commands (Rust/Tauri, Playwright, or the unshipped real-provider config) the per-platform sub-repo manifests omit, so this line is marked internal-only for the sync render.
- `pnpm sync:subrepos` — mirror the monorepo into the per-platform repos (`--only <name>`, `--dry-run`).
