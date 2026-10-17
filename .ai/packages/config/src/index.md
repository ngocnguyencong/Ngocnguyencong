# packages/config/src/index.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

2026-10-01: server-only `mobilePurchases` config defaults off. RevenueCat requires its secret API key and webhook authorization, maps a provider entitlement to a shared ledger key, and accepts blank sandbox configuration. Non-production allows sandbox unless disabled; production rejects an explicit sandbox grant request. All new credentials remain outside `parsePublicConfig`.

Single env schema for app/db/auth/email/billing/admin/observability/product
providers. `parseServerConfig` (zod, flat env → structured `ServerConfig`,
conditional-credential `superRefine`) and `parsePublicConfig` (client-safe
projection).

## First-run environment parsing

- 2026-10-02: `.env.example` intentionally leaves optional provider settings blank. `environmentBoolean` and `MAILGUN_REGION` now normalize through `optionalText` before enum validation; blank/whitespace behaves like unset, while invalid nonblank values still fail. Creem test mode and SMTP secure remain false by default; Mailgun remains `us`. Preserve conditional credential checks and server-only secrets. The actual example-file regression and selected-provider tests pass.

## Important Notes / NEVER Change

- When `APP_ENV` is omitted, `NODE_ENV=production` selects production validation
  before defaults or provider composition. Other runtimes keep the local default;
  an explicit app environment preserves intentional local/test/demo builds.

- `TRUSTED_PROXY_COUNT` accepts 0–10 and defaults to 0. Directly exposed
  deployments cannot authenticate forwarding headers; proxy IP keys are an
  explicit opt-in for deployments that control every counted hop.
- Env vars are declared alphabetically in `rawServerConfigSchema`; provider
  secrets are server-only — PublicConfig must never leak them (tests assert).
- `CAPTCHA_PROVIDER=off|turnstile` (default `off`); `turnstile` requires
  `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Server shape:
  `providers.captcha = { kind } | { kind, secretKey, siteKey }`; public shape:
  `captcha = { provider, turnstileSiteKey? }`.
- `ANALYTICS_PROVIDER=off|local|plausible|posthog` (default `off`);
  `plausible`/`posthog` require `ANALYTICS_SITE_ID` via `superRefine`;
  `ANALYTICS_HOST` is `optionalHttpsUrl` + https-only when set (self-host/EU
  override), with trailing slashes stripped at parse so
  `${host}/js/script.js` never doubles. Server shape:
  `providers.analytics = { kind } | { kind,
  siteId, host? }`; public config exposes only `analytics.provider` —
  the site id/host stay server-side.
- `AI_PROVIDER=openrouter` requires `OPENROUTER_API_KEY`; optional
  `OPENROUTER_APP_NAME`/`OPENROUTER_SITE_URL` spread into
  `{ kind:"openrouter", apiKey, appName?, siteUrl? }` (attribution headers).
- `AGENT_FRAMEWORK` (`ai-sdk|mastra|langgraph|openai-agents`, default
  `ai-sdk`) → `agents.framework` — selects the `@supastack/agents` adapter.
- `BILLING_PROVIDER=polar` requires `POLAR_ACCESS_TOKEN` +
  `POLAR_PRODUCT_ID` + `POLAR_WEBHOOK_SECRET`; `POLAR_SERVER`
  (sandbox|production, default sandbox); optional
  `POLAR_PRODUCT_ID_{PRO,PRO_YEARLY,LIFETIME}` per-plan ids.
  `BILLING_PROVIDER=whop` requires `WHOP_API_KEY` + `WHOP_PLAN_ID` +
  `WHOP_WEBHOOK_SECRET`; optional `WHOP_PLAN_ID_{PRO,PRO_YEARLY,LIFETIME}`.
- `BILLING_PROVIDER=paddle` requires `PADDLE_API_KEY` +
  `PADDLE_PRICE_ID` + `PADDLE_WEBHOOK_SECRET`; `PADDLE_ENVIRONMENT`
  (sandbox|production, default sandbox); optional
  `PADDLE_PRICE_ID_{PRO,PRO_YEARLY,LIFETIME}` per-plan ids.
  `BILLING_PROVIDER=dodo` requires `DODO_PAYMENTS_API_KEY` +
  `DODO_PAYMENTS_WEBHOOK_KEY` + `DODO_PRODUCT_ID`;
  `DODO_PAYMENTS_ENVIRONMENT` (test_mode|live_mode, default test_mode);
  optional `DODO_PRODUCT_ID_{PRO,PRO_YEARLY,LIFETIME}`.
  `BILLING_PROVIDER=paypal` requires `PAYPAL_CLIENT_ID` +
  `PAYPAL_CLIENT_SECRET` + `PAYPAL_PLAN_ID` + `PAYPAL_WEBHOOK_ID`
  (webhook id, not a secret — PayPal verifies remotely);
  `PAYPAL_ENVIRONMENT` (sandbox|live, default sandbox); optional
  `PAYPAL_PLAN_ID_{PRO,PRO_YEARLY,LIFETIME}`.
  `productPlanPriceMapFromEnv(env, "polar"|"whop"|"paddle"|"dodo"|
  "paypal")` reads the per-plan ids.
- `EMAIL_PROVIDER` += postmark|sendgrid|mailgun|smtp|brevo (routed via
  `@opencoredev/email-sdk`): `POSTMARK_SERVER_TOKEN`, `SENDGRID_API_KEY`,
  `MAILGUN_API_KEY`+`MAILGUN_DOMAIN`(+`MAILGUN_REGION`),
  `SMTP_HOST`(+`SMTP_PORT/USER/PASSWORD/SECURE`), `BREVO_API_KEY`.
- `CUSTOM_DOMAINS_PROVIDER` off|local|cloudflare (default off) →
  `customDomains`: cloudflare requires `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ZONE_ID`, `CUSTOM_DOMAIN_CNAME_TARGET`; local uses
  `customers.localhost`.
- `STORAGE_REGION` (default us-east-1) + `STORAGE_FORCE_PATH_STYLE`
  (tri-state; default true when `STORAGE_ENDPOINT` set — Supabase/MinIO).
- `RATE_LIMIT_STORE` (`memory`|`postgres`, optional) → `rateLimit.store`;
  unset resolves `postgres` when `NODE_ENV === "production"` (declared as
  `NODE_ENV` in the env schema), else `memory`. Server-only.
- `TRUSTED_PROXY_COUNT` (digit string, int 0–10, default `0`) →
  `rateLimit.trustedProxyCount`; how many XFF tail entries are
  proxy-written (0 = trust none → shared `unknown` bucket). Server-only.
- `PUBLIC_AI_DAILY_BUDGET_MICROUNITS` (non-negative bigint string, default
  `"0"`) → `publicAi.dailyBudgetMicrounits: bigint`; `0n` disables public AI.
- `observability` = conditional-spread `{ posthogHost?←NEXT_PUBLIC_POSTHOG_HOST,
  posthogKey?←NEXT_PUBLIC_POSTHOG_KEY, sentryDsn?←SENTRY_DSN,
  alertWebhookUrl?←ALERT_WEBHOOK_URL }` — keys absent when unset.
  `ALERT_WEBHOOK_URL` uses `optionalUrl` (`optionalText` piped through
  `z.string().url()`): empty → unset, non-URL string → parse error.
  Server-only — never in `publicConfigSchema`; endpoint for the generic
  HTTPS failure-alert webhook.
- `EXPO_ACCESS_TOKEN` (`optionalText`, optional) → `expo.accessToken` —
  bearer credential the server-side Expo push sender puts on
  `Authorization` headers; blank behaves like unset. Server-only —
  never in `publicConfigSchema`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `EXPO_ACCESS_TOKEN` (`optionalText`, server-only) → `expo.accessToken` | Devin |
| 2026-10-11 | `ANALYTICS_HOST` strips trailing slashes (`replace(/\/+$/,"")`) after https validation | Devin |
| 2026-10-10 | `ANALYTICS_PROVIDER` (off|local|plausible|posthog, default off) + conditional `ANALYTICS_SITE_ID` + https `ANALYTICS_HOST` → `providers.analytics`; public enum only | Devin |
| 2026-09-29 | `ALERT_WEBHOOK_URL` (optional URL via new `optionalUrl` helper, server-only) → `observability.alertWebhookUrl` | Devin |
| 2026-09-27 | `TRUSTED_PROXY_COUNT` (0–10, default 0) → `rateLimit.trustedProxyCount` | Devin |
| 2026-09-25 | `BILLING_PROVIDER` += paddle/dodo/paypal + provider envs + public enum | Devin |
| 2026-09-23 | `RATE_LIMIT_STORE` + `NODE_ENV` passthrough → `rateLimit.store` (Task 4); `PUBLIC_AI_DAILY_BUDGET_MICROUNITS` → `publicAi` (Task 6) | Devin |

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | feat/prod-ready-kit merge: `CONNECTED_{X,GOOGLE,MICROSOFT}_CLIENT_ID/SECRET` → `connectedAccounts` (X public-client ok), `RATE_LIMIT_STORE` (memory|postgres), `PUBLIC_AI_DAILY_BUDGET_MICROUNITS` (bigint), `SCHEDULER_TICK_SECRET`, `NODE_ENV` | Devin |
| 2026-09-25 | `BILLING_PROVIDER` += paddle/dodo/paypal + their envs (`PADDLE_*`, `DODO_*`, `PAYPAL_*` incl. environments + webhook ids) | Devin |
| 2026-09-22 | `BILLING_PROVIDER` += polar/whop + per-plan price ids; `EMAIL_PROVIDER` += email-sdk transports; `CUSTOM_DOMAINS_PROVIDER` + `CLOUDFLARE_*`/`CUSTOM_DOMAIN_CNAME_TARGET`; `STORAGE_REGION`/`STORAGE_FORCE_PATH_STYLE` | Devin |
| 2026-09-23 | `AI_PROVIDER=openrouter` + `OPENROUTER_*` envs; `AGENT_FRAMEWORK` → `agents.framework` | Devin |
| 2026-09-22 | `EARLY_ACCESS_INVITE_ONLY` (enum true|false, default false) → `earlyAccess.inviteOnly`; server-only, not in PublicConfig | Devin |
| 2026-09-22 | `BILLING_PROVIDER=creem` → `{ kind:"creem", apiKey, priceId←CREEM_PRODUCT_ID, testMode, webhookSecret }`; public enum extended | Devin |
| 2026-09-22 | `providers.captcha` + public `captcha` section (Turnstile) | Devin |

## 2026-10-04 — AWS SES

SES credentials are optional as a group. Empty values delegate to the AWS SDK default role/profile chain; partial explicit credentials fail validation. AWS_SESSION_TOKEN remains server-only and travels with an explicit key pair.
