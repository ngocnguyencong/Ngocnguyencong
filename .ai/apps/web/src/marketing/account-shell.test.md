# apps/web/src/marketing/account-shell.test.ts

## Purpose
Regression coverage for configured marketing theme attributes on account
pages (the `ConsentBanner` capture flag is mocked so the shell renders
deterministically regardless of `ANALYTICS_PROVIDER`).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | `./site-header` mock updated to `SiteHeaderClient` (component split) | Devin |
| 2026-10-10 | Mock updates for the prop-driven `ConsentBanner` + `resolveAnalyticsConfig` import | Devin |

