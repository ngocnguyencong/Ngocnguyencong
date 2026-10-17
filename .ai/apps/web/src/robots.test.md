# src/robots.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Robots contract test: `robots()` disallows the app prefixes (`/setup`,
`/admin`, `/settings`, `/billing`, `/api/`), no `/*/setup` localized mirror
exists, and `/setup` stays out of `marketingStaticPaths` (sitemap input).

## Important Notes

- Mocks `server-only` — `robots.ts` imports `siteOrigin` from the
  server-only SEO module.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
