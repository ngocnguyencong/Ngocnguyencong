# AGENTS.md (repo root)

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Agent-facing contract: non-negotiable boundaries (no merge/push/deploy
without consent, `.ai` mirror rule, TDD, workspaceId scoping,
buyer-clean sub-repo sync, desktop-as-webview-shell), default visual
skills, theme/layout customization axes, icon + SEO rules, dev commands.

## Important Notes

- Default demo branding is text-only. No proprietary logo artwork ships in
  web, email, social previews, or desktop. Native icon resources are blank
  packaging placeholders; product builders supply their own assets. Commit
  messages and docs must stay generic too.

- Demo content is a non-negotiable boundary across web/desktop, mobile,
  metadata, translations, assets, comments, tests, and shipped docs. Keep
  neutral, replaceable examples; prohibit real customer quotes, identities,
  portraits, trust counts, statistics, and production marketing promises.
  The main policy bullet intentionally avoids transit-filter keywords so the
  same content contract survives every generated platform AGENTS.md.

- Dev commands document the gate split (2026-09-22): `check:local` /
  `verify:local` are the non-desktop gates (no Rust), `verify:desktop`
  needs Rust + Tauri prereqs, `check` stays the full CI gate incl.
  `cargo check` for `apps/desktop`. 2026-10-06: shipped-text honesty —
  lines naming commands only some repos ship (`test`, `dev:desktop`,
  `verify:*`, `build:desktop`, `typecheck:desktop`, `test:e2e*`,
  `smoke:providers`, `supabase:provision`/`supabase:doctor`) are marked
  internal-only so rendered AGENTS.md never names a missing script;
  `check:local`/`typecheck:local` now emit via `KEEP_SCRIPTS` instead.
- `renderAgentsMd` in `scripts/subrepos.mjs` drops the `Sub-repos (` bullet
  plus every `INTERNAL_ONLY_LINE` match when generating the buyer-facing
  AGENTS.md — the `.ai/` memory rule survives because `.ai` mirror docs now
  ship (scrubbed in transit by `renderAiMirror`). Keep monorepo-internal
  references clearly marked for the shared filter.
- `.ai/` mirror docs are repo-scoped: they describe this repository only —
  never reference other repositories, private products, or maintainer-only
  checkouts. `tests/ai-docs.test.ts` enforces the ban list.

## Open Threads / Resume Context

None.

`DEFAULT_STYLE_ID` in web `theme/styles.ts` is the one-line product style
default. Server-rendered attributes and startup restore all six axes from it.
Marketing inherits by default; saved visitor choices override code defaults.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Feature bullets: cross-device appearance sync (Themes section), `/setup` checklist + Settings → Usage/`USAGE_METERS` (Billing/deployment section), mobile offline cache + workspace export + `push.receipts` schedule + desktop `{{channel}}`/`SUPASTACK_UPDATE_CHANNEL` (boundaries section) | Devin |
| 2026-10-10 | Billing/email/domains section += `ANALYTICS_PROVIDER` bullet (off\|local\|plausible\|posthog; consent-gated local beacon → `analytics_event`, vendor scripts after consent, `ANALYTICS_SITE_ID`/`ANALYTICS_HOST`) | Devin |
| 2026-10-06 | Dev-commands + Supabase bullets restructured so every line the sync renderer ships names only universally-shipped scripts (internal-only commands sit on `INTERNAL_ONLY_LINE`-marked lines); NEVER-publish bullet's `(including sync:subrepos)` clause moved to its own droppable line | Devin |
| 2026-10-06 | Boundaries += repo `llms.txt` entry-map bullet (strips downstream via `sub-repo` term); Sub-repos bullet += curated docs/prompts `extraPaths` + generated `llms.txt`; SEO section += Agent index bullet | Devin |
| 2026-10-04 | Neutral demo-content boundary across all surfaces; survives platform instruction rendering | Codex |
| 2026-10-02 | Scheduler bullet += skipped occurrences accumulate in `job_schedule.missed_runs` (claim-time delta; Cron schedules settings list shows the total) | Devin |
| 2026-09-27 | Scheduler bullet += `email.digest` workspace-schedule example; Block library lists += paywall-gate, data-viz bars/donut/metric-trend (app), chart-line (marketing) | Devin |
| 2026-09-26 | Sub-repos bullet rewritten: `.ai/` mirror docs now ship (scoped to shipped files, internal-only lines stripped in transit); renderAgentsMd note updated for shared `INTERNAL_ONLY_LINE` filter | Devin |
| 2026-09-27 | Documented shared static OG asset placement, explicit per-page metadata, and article-generated exception | Codex |
| 2026-09-27 | prod-ready-kit merge: JobRunner line += `job_schedule` durable-claim mechanism (tick endpoint + `scheduler.tick` cron); Block library += minimal set; dev commands += `pnpm jobs:tick` | Devin |
| 2026-09-25 | `BILLING_PROVIDER` list += paddle/dodo/paypal | Devin |
| 2026-09-22 | Billing/email provider lists, custom domains, Supabase deploy sections | Devin |
| 2026-09-22 | Dev commands: verify:local/verify:desktop + cargo-check note on check | Devin |

## 2026-10-06
Document the shared responsive shell, four new packs, semantic/control/motion tokens, accessible primitives, and controlled app blocks. The default demo identity remains neutral and black.
