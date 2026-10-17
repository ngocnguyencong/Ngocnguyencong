# Deployment

Supastack deploys as a Next.js web application backed by Postgres, with the Expo
mobile app consuming the same API. This guide covers the production topology;
the real-provider smoke guide shipped with the `supastack-web` repository
covers provider acceptance.

## Topology

- **Web** (`apps/web`): Next.js server — marketing site, app shell, BFF, `/api/v1`,
  webhook receivers, `/api/health` and `/status`.
- **Database**: Postgres 16+ with the Drizzle migrations in
  `packages/db/drizzle/` applied.
- **Background jobs**: Trigger.dev (or the local runner for development).
- **Storage**: any S3-compatible bucket; MinIO via the `docker-compose.yml` in
  the `supastack-web` checkout.
- **Email**: Resend or SES transactional sender; the local outbox is for dev only.
- **Billing**: Stripe, Lemon Squeezy, Creem, Polar, Whop, Paddle, Dodo Payments, or
  PayPal on web (`BILLING_PROVIDER`); RevenueCat on mobile. Mobile never exposes
  Stripe Checkout. To add a provider, follow the custom-billing-adapter guide
  shipped with the `supastack-web` repository.
- **AI**: configured provider keys stay server-only; workspaces can bring their
  own keys via BYOK.

## Local services

In the `supastack-web` checkout, `docker compose up -d postgres` starts Postgres
with the `supastack` credentials matching `.env.example`. The `storage` profile
adds MinIO on `:9000` (console `:9001`). For development, run the app there with
`corepack pnpm dev`.

## Self-hosted app image

The root `Dockerfile` in the `supastack-web` checkout builds a production image
using Next.js standalone output (run there):

```bash
docker build -t supastack-web .
docker run -p 3000:8080 --env-file .env supastack-web
```

Or via Compose in the same checkout (includes Postgres, waits for it to be
healthy):

```bash
docker compose --profile app up -d web
```

The image always starts in production mode, including when an env-file contains
`APP_ENV=local`. Supply production provider settings and credentials; the copied
`.env.example` alone is not a production configuration. For the credential-free
local demo, use `corepack pnpm dev`.

Secrets are supplied at runtime through the environment — they are never baked
into the image. Run migrations (`corepack pnpm --filter @supastack/db db:migrate`
in the `supastack-web` checkout) against the target database before first start.

For a step-by-step walkthrough of running this image on a cheap VPS managed by
Coolify (including Postgres, TLS, and the scheduler tick), see the VPS+Coolify
guide (`docs/vps-coolify.md`) shipped with the `supastack-web` repository.

## Build and run

In the `supastack-web` checkout:

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm --filter @supastack/web build   # in the supastack-web checkout
corepack pnpm --filter @supastack/web start   # in the supastack-web checkout
```

## Environment

`.env.example` is the configuration inventory. Server-only secrets — database
URL, auth secret, Stripe secret/webhook keys, provider API keys, webhook signing
secrets — must never be prefixed `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

Key groups:

- `DATABASE_URL` — Postgres connection string.
- Auth — `AUTH_PROVIDER=better-auth` (default, full feature set) or `authjs`
  (Auth.js v5 engine: JWT sessions, shared `user` table, same OAuth env config;
  impersonation/passkeys/TOTP/OTP/magic-link are Better Auth-only). `AUTH_SECRET`
  signs both engines' tokens.
- Providers — the `*_PROVIDER` selectors (`AI_PROVIDER`, `BILLING_PROVIDER`,
  `EMAIL_PROVIDER`, `JOB_PROVIDER`, `STORAGE_PROVIDER`) pick `local`/`fake`/
  `memory` defaults or a real backend (`stripe`/`resend`/`ses`/`trigger`/…).
- `ADMIN_EMAILS` — bootstrap list for the platform admin role.

## Health and observability

- `GET /api/health` returns service status for uptime checks.
- `/status` renders a public status page.
- `/api/v1` requests are rate-limited through a fixed-window store:
  `RATE_LIMIT_STORE` defaults to `postgres` under `NODE_ENV=production`
  (shared `rate_limit_bucket` rows — multi-instance deployments already share
  limits) and `memory` otherwise; set `RATE_LIMIT_STORE` to override, or put an
  edge limiter in front. Anonymous buckets key on the client IP taken
  `TRUSTED_PROXY_COUNT` entries from the right of `x-forwarded-for` (default
  0 for direct exposure) — set it to the number of proxies you control;
  leading entries are client-controlled and never trusted.
- Audit events, webhook deliveries, and job runs are recorded in Postgres.

## Post-deploy verification

Use the [agent security and acceptance checklist](agent-security.md) for
authentication, cross-user workspace isolation, RLS exposure, redacted logging
and recovery evidence. Mark unavailable checks `BLOCKED` or `NOT RUN`; an
`/api/health` response alone does not establish production readiness.

1. Apply migrations, then hit `/api/health` — expect `ok`.
2. Sign in, confirm workspace isolation, and run a saved task end to end.
3. Exercise the billing webhook in sandbox and confirm entitlement change —
   Stripe posts to `/api/billing/webhook`, Lemon Squeezy posts to
   `/api/billing/webhook/lemonsqueezy` with the `x-signature` header, Creem
   posts to `/api/billing/webhook/creem` with the `creem-signature` header;
   Polar, Whop, and Dodo Payments post Standard Webhooks headers to their
   `/api/billing/webhook/<provider>` receivers, Paddle posts the
   `Paddle-Signature` header to `/api/billing/webhook/paddle`, and PayPal
   posts `PayPal-*` transmission headers to `/api/billing/webhook/paypal`.
4. Follow the real-provider smoke guide shipped with the `supastack-web`
   repository for paid-provider acceptance.
