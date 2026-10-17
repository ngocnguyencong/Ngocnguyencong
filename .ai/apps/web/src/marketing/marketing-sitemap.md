# apps/web/src/marketing/marketing-sitemap.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Declares which routes the public sitemap exposes. `marketingStaticPaths` is the
static list; `buildMarketingSitemapEntries()` enriches it with `priority`,
`changeFrequency`, and `lastModified` (blog posts carry their `post.date`);
`buildMarketingSitemapPaths()` is the string-only view kept for callers/tests.
`app/sitemap.ts` turns entries into absolute `MetadataRoute.Sitemap` URLs via
`siteOrigin()`.

## Important Notes

- Private/app/dev routes must never appear here (test asserts the omission);
  `app/robots.ts` is the mirror contract on the disallow side.
- Publishes en/de/es/fr docs indexes and every guide through the dynamic docs source. Locale paths stay outside the literal static route list because their route folder is `[locale]`.
- Priorities: `/` = 1, blog/docs indexes = 0.8, FAQ + posts + `/changelog` =
  0.7 (changelog is `weekly`), guides = 0.6, contact/showcase/`/roadmap`/
  `/api-reference` = 0.5 (`monthly`), legal = 0.3. Only emit `lastModified`
  from real content dates — no guessed dates for guides/static pages.
- Adding a public route = add static path + meta (+test), or extend the dynamic
  sources (`posts`, `guides` from `src/resources/content`). The new route's
  page file must also export `force-dynamic` — `public-routes-dynamic.test.ts`
  iterates `marketingStaticPaths` and fails otherwise (absolute URLs must
  resolve `APP_URL` at request time).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Added `/changelog` (weekly, 0.7), `/roadmap` + `/api-reference` (monthly, 0.5) | Devin |
| 2026-09-27 | Added `/legal/acceptable-use` + `/legal/disclaimer` (yearly, 0.3) | Devin |
| 2026-09-27 | Added `/legal/license` (yearly, 0.3) — public license terms page | Devin |
| 2026-09-24 | Note: `marketingStaticPaths` now also drives the force-dynamic route contract test | Devin |
| 2026-09-21 | Added `buildMarketingSitemapEntries` with priority/changeFrequency/lastModified | Devin |
