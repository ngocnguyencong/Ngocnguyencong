# resources/content.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Canonical English data + types for the public reading surfaces: `Post`
(blog articles), `Guide` (docs pages), `docTabs`, `categories`, and the
search/date helpers (`findGuide`, `searchGuides`, `readingMinutes`,
`formatPostDate`, `filterPosts`). This kit renders posts English-only —
per-locale overlays are a product concern, not kit scope.

## What It Does

- `Section = { id, title, paragraphs[], code?, items?, table? }` — the
  shared block model for posts AND guides. `code` is never translated
  (structural); `table` is a `SectionTable { head[], rows[][], accentColumn? }`
  rendered as a real `<table>` by `Sections` in `resource-pages.tsx` and
  serialized to Markdown by `guideToMarkdown`/`sectionTableText`.
- Slugs and section ids are stable identifiers — overlays and URLs key
  off them; never rename casually.
- `Guide.tab` has Web, Mobile, Desktop and Modules surfaces. The three
  `<surface>/local-setup` guides are the first item in their platform tabs;
  Desktop guides use their own `desktop` tab.
- `Guide.continueTo` is the topic/depth navigation destination. The independent
  `setupFlowTo` destination feeds an inline setup sentence and may point to a
  different article, such as database topic navigation versus billing setup.
- `posts` order is the blog index order (newest first by convention).

## Important Notes / NEVER Change

- The mobile introduction describes shipped Expo auth/session, workspace,
  settings, chat and RevenueCat purchase workflows accurately. The web API and
  shared server packages remain authoritative for data, authorization and
  provider verification.
- An empty `table.head[0]` marks a row-label column — `Sections` then
  renders first cells as `<th scope="row">`; a named corner keeps the
  first column as plain data.
- `accentColumn` is the brand-agnostic way to highlight a column (e.g. a
  "vs competitor" post highlighting the product's own column); never
  hardcode a brand name in the renderer.
- Every `table.rows[i].length === head.length` and `accentColumn` stays
  in range — pinned by `resource-pages.test.ts`.
- `mobile/store-submission` (group "Distribution") is the release-path guide:
  eas.json profiles, EAS-managed signing, Play service account at the
  git-ignored `apps/mobile/secrets/` path, internal-track draft submit, Play
  Data-safety/Apple review-notes forms, the RevenueCat purchases gate, an
  `items[]` checklist section, and rejection recovery — points at
  `docs/mobile-store-submission.md`. The shipped RevenueCat purchase/restore
  flow is enabled through configuration and public platform SDK keys, then
  refreshed from the server-verified workspace entitlement. Store-specific
  requirements are checked against current guidance for the target app and
  regions rather than stated as a universal rule.
- `modules/observability` gained three sections (2026-09-29): `correlation`
  (corr_<uuid> minted at AI-task submit / billing webhook routes / scheduler
  dispatch, riding event properties + webhook_delivery payload meta),
  `alerting` (`ALERT_WEBHOOK_URL` generic HTTPS POST, `job.failed` warning +
  `webhook.delivery_failed` critical), and `metrics`
  (`serverObservability.measure` `<name>.duration` events + `logger` JSON
  stdout lines). The logger guide now says messages are static text, only
  structured context is redacted by sensitive key, and raw request bodies,
  credentials, environment-variable values, and URLs must stay out of logs.

## Change History

| Date       | Change | Author |
| ---------- | ------ | ------ |
| 2026-09-29 | `modules/observability` guide += `correlation`/`alerting`/`metrics` sections for the correlation-id + alerting + duration-metrics feature | Devin |
| 2026-10-07 | Corrected logger-redaction wording to describe static messages, sensitive-key redaction in structured context, and prohibited raw request bodies, credentials, environment-variable values, and URLs | Codex |
| 2026-10-01 | Clarified that the shipped native RevenueCat purchase/restore flow is configured with public platform keys and verified by the server; release checks defer to current requirements for the app and its regions | Codex |
| 2026-09-28 | +`mobile/store-submission` guide ("Distribution") — EAS build/submit release path; `mobile/entitlements` cross-links purchases + submission guides | Devin |
| 2026-09-27 | Clarified Expo starter scope in the first Mobile overview paragraph | Codex |
| 2026-09-23 | `SectionTable` added to `Section` (head/rows/accentColumn); demo table in `a-foundation-for-your-next-product` `product-boundary`; `searchGuides` indexes table text | Devin |

## Docs overhaul (2026-10-01)

Complete content inventory with grouped navigation, inline references, shared ranked search, a five-minute local quickstart and deliberate continuation destinations. English slugs and existing docs layout/CSS stay intact. Human-readable guide content is localized into de/es/fr; identifiers and code remain stable.

## Beginner documentation (2026-10-02)

In progress: integrate static beginner first-run replacements and tool/terminal preparation guides before organizing navigation and building the directory. Preserve existing slugs and source catalogs; zero-database demo starts at `/ai`, while `/auth` requires migrated Postgres.
