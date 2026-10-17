# docs/deployment.md

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose（一句话人话）

The canonical production-topology doc — what the web app deploys as and what
must be true around it (DB, jobs, storage, email, billing, AI).

## What It Does

- Maps the topology: Next.js web (marketing + app shell + BFF + `/api/v1` +
  webhook receivers + `/api/health` + `/status`), Postgres 16+ with Drizzle
  migrations, Trigger.dev/local jobs, S3 storage, transactional email,
  `BILLING_PROVIDER` adapters (9 providers) + RevenueCat on mobile.
- Documents the self-hosted image: root `Dockerfile` → Next.js standalone,
  runtime-only secrets, `db:migrate` before first start — and points to the
  VPS+Coolify guide for the managed-VPS walkthrough. Because this doc ships
  to the mobile/desktop repos (which lack `Dockerfile`, `docker-compose.yml`,
  and the web-only guides), references to those carry an explicit
  "`supastack-web` checkout" qualifier and `pnpm --filter` commands are
  marked same-line — no dangling cross-repo file references.
- Production image startup forces production mode even if an env-file contains
  the example's local-mode value; production provider credentials are required.
- Owns the post-deploy verification checklist (health → sign-in → workspace
  isolation → billing webhook sandbox per provider → real-provider smoke)
  that other deploy docs reference instead of repeating.
- Anonymous IP quotas ignore forwarding headers by default. Operators may set
  `TRUSTED_PROXY_COUNT` to the number of controlled proxies that append them.

## Open Threads / Resume Context

None — the stale "in-process" rate-limiter line was corrected on 2026-09-26
(doc now states `RATE_LIMIT_STORE`: `postgres` shared buckets in production,
`memory` otherwise). The same bullet now covers `TRUSTED_PROXY_COUNT`:
anonymous buckets key on the client IP that many XFF entries from the right
(default 0 — trust no forwarding entries until the deployment declares its
controlled proxy count; leading entries are never trusted).

## Agent Decisions / Thoughts

- 2026-10-07: Post-deploy checks link the shared agent security acceptance
  checklist; health success alone is insufficient evidence for readiness.

- Terse operational register, no marketing voice — this doc is the tone
  reference for every other ops doc in `docs/`.

## Important Notes / NEVER Change

- Webhook receiver paths listed here (`/api/billing/webhook[/<provider>]` +
  per-provider signature headers) are the contract other docs link to — keep
  them in sync with `app/api/billing/webhook/*/route.ts`.
- "Secrets never `NEXT_PUBLIC_`/`EXPO_PUBLIC_`-prefixed" is a hard rule.

## Change History

| Date       | Change                                                                                                                                               | Author |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-10-06 | `PROVIDERS_*` invented name → real `*_PROVIDER` selector family (AI/BILLING/EMAIL/JOB/STORAGE); `up postgres` → `up -d postgres`; bare `pnpm` → `corepack pnpm`; cross-repo references qualified with "supastack-web checkout" prose (doc ships to mobile/desktop where those files don't exist) | Devin  |
| 2026-09-27 | Rate-limiter bullet += `TRUSTED_PROXY_COUNT` (anonymous keys = client IP N XFF entries from the right)                                                 | Devin  |
| 2026-09-26 | Billing topology bullet += pointer to `docs/custom-billing-adapter.md` (add-a-provider recipe)                                                       | Devin  |
| 2026-09-26 | Migrations path shorthand `drizzle/` → `packages/db/drizzle/`                                                                                        | Devin  |
| 2026-09-26 | Rate-limiter bullet corrected to store-aware truth (`RATE_LIMIT_STORE`: postgres in production, memory otherwise); `docker run` port fix `3000:8080` | Devin  |
| 2026-09-26 | +1 line pointer to `docs/vps-coolify.md` under "Self-hosted app image"                                                                               | Devin  |
| (older)    | Provider/topology sections — pre-mirror history; see git log                                                                                         | —      |
