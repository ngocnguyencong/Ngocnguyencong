# packages/config/src/index.test.ts

> Last updated: 2026-10-12 | Protection: STANDARD

## Purpose

Production runtime regression checks require credentials when `NODE_ENV=production`
and `APP_ENV` is omitted, including the exported schema boundary. Explicit local
configuration and default local/test setup remain valid.
Fully configured production input also parses successfully without `APP_ENV`,
so the fallback rejects unsafe defaults without blocking valid hosts.

2026-10-01: four purchase-config regressions cover off/blank defaults, conditional RevenueCat credentials, secret-free client projection and production sandbox rejection.

2026-10-10: analytics provider coverage — `ANALYTICS_PROVIDER` default `off`
and every enum value, `ANALYTICS_SITE_ID` required for `plausible`/`posthog`
but not `off`/`local`, `ANALYTICS_HOST` accepts https, rejects non-https,
and strips trailing slashes (`https://x/` → `https://x`),
and the public projection carries only `analytics.provider` (site id/host
never leak).

2026-10-02: the suite now has 45 cases. Added a real `.env.example` parsing regression, blank/whitespace/unset provider defaults (including selected providers), explicit boolean/region options, and invalid-value rejection. The example and two blank cases reproduced the reported three-field ZodError before the schema fix; all 45 cases pass afterwards.

`parseServerConfig`/`parsePublicConfig` env-schema tests (30): provider
required-key errors + parsed shapes (openai, anthropic, openai-compatible,
openrouter incl. optional appName/siteUrl), `AGENT_FRAMEWORK` default +
each value, public-config redaction, captcha/billing/early-access
sections, paddle/dodo/paypal credential gating + parsed billing
shapes (incl. environment defaults), and `ALERT_WEBHOOK_URL`
optional-URL parsing (unset/empty → absent, non-URL → parse error)
with a server-only leak guard. `EXPO_ACCESS_TOKEN` coverage mirrors
`SCHEDULER_TICK_SECRET`: unset/blank → `expo.accessToken` undefined,
set → parsed, and a `parsePublicConfig` serialization check proves
the credential never reaches client config.

## Change History

The trusted-proxy count test pins a safe default of 0 and rejects values
outside 0–10.

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-12 | `EXPO_ACCESS_TOKEN` optional/blank/parse + public-config leak-guard case | Devin |
| 2026-10-11 | `ANALYTICS_HOST` trailing-slash normalization cases | Devin |
| 2026-10-10 | `ANALYTICS_PROVIDER` enum/default, conditional `ANALYTICS_SITE_ID`, https-only `ANALYTICS_HOST`, public-projection redaction tests | Devin |
| 2026-09-29 | `ALERT_WEBHOOK_URL` optional-URL + server-only tests (observability alerting) | Devin |
| 2026-09-25 | paddle/dodo/paypal required-credential + parsed-shape tests | Devin |
| 2026-09-23 | `rateLimit.store` env-resolution tests (Task 4) + `publicAi.dailyBudgetMicrounits` parsing/rejection tests (Task 6) | Devin |
| 2026-09-23 | OpenRouter shape + AGENT_FRAMEWORK tests | Devin |
