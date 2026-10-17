# docs/vps-coolify.md

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose（一句话人话）

Step-by-step operator guide for self-hosting the web app on one cheap VPS via
Coolify — the "no Vercel/Railway" path buyers asked for.

## What It Does

- Sizes the box honestly: Coolify's documented floor (2c/2GB/10GB free disk)
  vs the real constraint — the in-image monorepo `pnpm install` + `next
  build` (~4GB comfortable, ~2GB floor with swap +
  `NODE_OPTIONS=--max-old-space-size` via Coolify build vars; Dockerfile
  declares no `ARG NODE_OPTIONS`). ~30GB is stated as practical advice, not
  the documented minimum.
- Documents the cheaper alternative: CI-built image (GHCR) → Coolify "Docker
  Image" resource → ~1–2GB VPS only runs standalone (~150–300MB RSS estimate).
- Covers install (official `install.sh`, ports 22/80/443/8000/6001/6002),
  Postgres options (Coolify-managed w/ pg_dump duty vs managed; unique
  production credentials, private DB access, and no `supastack:supastack`
  defaults), Dockerfile
  build pack on **Ports Exposes** 8080 (or `https://domain:8080` suffix) +
  `/api/health` healthcheck — with the caveat that Coolify's HTTP check runs
  inside the container and needs `curl`/`wget` (BusyBox `wget` in
  `node:22-alpine` satisfies it today; distroless/wget-less rebases break
  it). Runtime-only env (incl. the `APP_ENV=production` required set) — the
  env UI carries both "Build Variable" and "Runtime Variable" checkboxes,
  keep Build off secrets — private Postgres migration via a throwaway Node 22
  container attached to the same Coolify network, TLS,
  `JOB_PROVIDER=local` scheduler-tick Scheduled Task (`* * * * *` or the
  named `every_minute` — `@every_minute` is invalid and one malformed
  expression can break all tasks) vs `trigger`, storage/email/billing
  webhook pointers, and the shared verification checklist.
- Migration commands require an explicitly injected production
  `DATABASE_URL`, guard against the local `.env` fallback, and keep the value
  out of command literals, shell history, and reports. Post-deploy checks link
  to the setup runbook and `docs/agent-security.md`; health/demo success does
  not prove sign-in or cross-user isolation.
- The standard private-database path runs before first deploy from a checkout
  on the Coolify server; the one-shot container joins the shared destination
  network and receives only a mode-600 `DATABASE_URL` file. Host Node.js and a
  public database port are unnecessary. Local mail preview is dev-only; use a
  real transactional provider for production email-auth acceptance.

## Agent Decisions / Thoughts

- RAM numbers are stated as guidance/estimates, not benchmarks — the honest
  framing buyers need, matching deployment.md's terse operational tone.
- Rate-limit note deliberately describes `RATE_LIMIT_STORE=postgres`
  (production default) rather than repeating deployment.md's older
  "in-process" phrasing — both true, the store-aware version is more useful
  for multi-instance questions.
- Tick command uses `node -e fetch(...)` inside the container because
  node:22-alpine guarantees node and BusyBox `wget` but not curl — `node`
  is the portable choice, and the same `wget` presence is what Coolify's
  in-container HTTP healthcheck depends on.

## Important Notes / NEVER Change

- Keep port `8080`, health path `/api/health`, migrate command
  `pnpm --filter @supastack/db db:migrate`, and the `x-scheduler-key` header
  in sync with the Dockerfile/route/config code — they are pinned there, not
  invented here.
- Keep Coolify-managed Postgres on a private shared network; the migrator and
  app must resolve the same internal database hostname there.
- `APP_URL` must stay "exact non-local HTTPS origin" — `packages/config`
  validates it when `APP_ENV=production`.
- Use unique production Postgres credentials and keep the database private;
  local Compose defaults are demonstrations only.

## Change History

| Date       | Change                                                                                                                                         | Author |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-10-07 | Adds the private-network Node 22 migrator and dev-only mail-preview/production transactional-email distinction | Devin |
| 2026-10-07 | Requires unique private Postgres credentials; guarded migration URL injection; links shared security acceptance and distinguishes health/demo from real auth/isolation | Devin |
| 2026-10-06 | Coolify v4 audit pass: disk floor corrected to documented 10GB (~30GB kept as practical advice); "Ports Exposes" field name + domain `:8080` suffix alternative; healthcheck caveat (runs in-container, needs `curl`/`wget`); "Runtime Variable" checkbox named beside "Build Variable"; `every_minute` named schedule + `@every_minute`/malformed-expression warning; v4.3.0+ UI label-drift note; `corepack pnpm` in the migrations block | Devin  |
| 2026-09-26 | Section order fixed to env → migrate → deploy (honest op sequence); install wording now says web-workspace closure (packages/ + apps/web only) | Devin  |
| 2026-09-26 | Nits: `packages/db/drizzle/` path (was `drizzle/`); `EXPO_PUBLIC_APP_SCHEME` web-only hint                                                     | Devin  |
| 2026-09-26 | Initial doc: VPS+Coolify self-hosting walkthrough (buyer request)                                                                              | Devin  |
