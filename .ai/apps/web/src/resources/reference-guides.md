# reference-guides.ts

## Purpose

Complete public environment, command, package and API-route inventories, plus a linked guide directory derived from the same content and navigation catalog.

## What It Does

`apps/web/src/resources/reference-guides.ts` exports the buyer-facing Reference guides. English data is static at runtime and includes the complete safe `.env.example` key inventory, buyer-safe scripts, shipped workspace packages/apps, API route methods and authentication boundaries, and the documentation directory. It does not read `.env` files or expose sub-repo sync variables.

The translation snapshots under `apps/web/src/resources/translations/reference.{de,es,fr}.json` use the English source strings as keys and provide translated human-facing strings per locale (312 exact source strings; snapshot completeness is test-enforced, so adding an env-guide row without a locale entry fails `docs-i18n.test.ts`). Paths, code, slugs, ids, HTTP methods and routes, and environment variable names remain source identifiers. The guide covers all 170 unique keys in the safe `.env.example` inventory, including the local Postgres and MinIO Compose credential overrides, and 97 API route handlers; private credentials and operational values remain omitted.

## Important Notes

- The desktop icons command uses a blank placeholder; product builders replace
  it with their own icon source. Keep the locale command descriptions aligned.

- Exclude private sync variables/commands. Never inspect or publish real .env values.
- Route inventory describes authorization and methods, not a claim that all endpoints are public API.
- The environment index explains that the Compose Postgres fallback is local-only and that deployed Postgres and MinIO credentials must be unique.

## Open Threads

- **Status:** complete
- 2026-10-02 in progress: add beginner instructions for reading environment/command/package/API inventories, including files, command syntax and expected outcomes.
- **Intent:** provide complete English reference guides and source-string German, Spanish, and French translations without changing docs UI/layout/CSS.
- **Next steps:** update this mirror whenever a documented source inventory or its translation changes.
- **Notes:** codebase-memory MCP graph tools were unavailable, so discovery uses the repository files. Never inspect or publish real `.env` values.

## 2026-10-12 — new env keys

`EXPO_ACCESS_TOKEN` (server-only Expo push credential) joined the
application/identity table after the mobile rows, and
`SUPASTACK_UPDATER_ENDPOINT, SUPASTACK_UPDATER_PUBKEY` joined after the
desktop rows — the env-inventory test scans `.env.example` for every key,
so new variables must appear here. Purpose strings translated in
`beginners.{de,es,fr}.json`.

## 2026-10-12 — mobile content/commerce routes

The `api-routes` guide's mobile table gained six rows for the new CMS +
commerce BFF surface (`/api/mobile/content` GET/POST,
`/api/mobile/content/[entryId]` PATCH/DELETE,
`/api/mobile/commerce/products` GET/POST, `products/[productId]` PATCH,
`/api/mobile/commerce/orders` GET, `orders/[orderId]` PATCH) and the
section paragraph now names commerce (owner/admin) and CMS content
(member+). Matching de/es/fr entries were added to
`reference.{de,es,fr}.json` — the api-route inventory test walks
`app/api` for route files, so new routes must appear here.

## 2026-10-10 — API reference link

The `api-routes` guide section gained a `links` entry pointing readers at the public `/api-reference` page ("Browse the API reference" — endpoint list rendered from the published OpenAPI document). Matching translated strings were added to `reference.{de,es,fr}.json` so `docs-i18n.test.ts` completeness stays green.

## 2026-10-04 — AWS SES

AWS SES setup guidance covers verified identity/region/sandbox, classic IAM SMTP creation/management links, separate API keys or roles/session tokens, SMTP STARTTLS, all-platform server-only configuration, and current Mail Manager pricing. The optional open/mTLS endpoint fee is $50/month; authenticated endpoints are currently complimentary. Guide links, localized overlays and environment inventories stay aligned.

## 2026-10-13 — Mobile content item GET

`/api/mobile/content/[entryId]` row now lists `GET/PATCH/DELETE` and mentions the single-entry body read the mobile editor uses for full-form prefill.

2026-10-16: api-routes tables gained rows for the WP1/WP2/WP8 routes — `/api/account/appearance` (GET/PUT) in identity/billing, `/api/mobile/appearance` (GET/PUT) and `/api/mobile/usage` (GET) in the mobile table, `/api/workspace/export` (GET, owner/admin) in the workspace table; the environment table's updater row now mentions the optional `{{channel}}` placeholder and a `SUPASTACK_UPDATE_CHANNEL` row was added. Purpose strings translated in `reference.{de,es,fr}.json` and `beginners.{de,es,fr}.json`.
