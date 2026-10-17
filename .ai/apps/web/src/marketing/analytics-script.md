# src/marketing/analytics-script.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

`MarketingAnalytics` — the marketing-surface analytics mount point
(server component). Resolves `ANALYTICS_PROVIDER` once per request and
renders the matching consent-gated client island; mounted by `SiteFooter`
so it covers every page that renders the marketing footer.

## What It Does

- `off`, or a script provider without `ANALYTICS_SITE_ID` → renders
  nothing (`clientCaptureEnabledFor` gate).
- `local` → `<AnalyticsBeacon clientCaptureEnabled />`.
- `plausible`/`posthog` → `<AnalyticsScriptClient provider siteId host?
  clientCaptureEnabled />`.

## Dependencies

- `../analytics` `resolveAnalyticsConfig` (server-only),
  `./analytics-beacon`, `./analytics-script-client`,
  `./marketing-consent` `clientCaptureEnabledFor`.

## Important Notes

- Server-side resolution means the configured provider never reaches the
  client as a secret — only the public siteId/host props cross the
  boundary.
- Mount here, not in the authenticated app shell — analytics stays off
  the product surface by construction.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Initial mount component | Devin |
