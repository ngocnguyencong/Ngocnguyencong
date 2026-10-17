# apps/web/app/roadmap/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

English `/roadmap` route: `force-dynamic` `metadata` export (title,
~150-char description, canonical, `pageLanguageAlternates` hreflang), a
`BreadcrumbList` JSON-LD, and `ResourceShell` wrapping `RoadmapPage`.

## Important Notes

- Reads `x-supastack-locale` via `headers()`; a non-`en` resolution
  redirects to `/{locale}/roadmap` — same convention as
  `app/docs/[[...slug]]/page.tsx`.
- `force-dynamic` because canonical/JSON-LD URLs resolve runtime
  `APP_URL`; `public-routes-dynamic.test.ts` enforces it via
  `marketingStaticPaths`.
- `alternates.languages` via `pageLanguageAlternates("/roadmap")`.
- This route sets NO page-level `openGraph`/`twitter` — it inherits the
  root layout's card (en_US, `rootOgImage`), correct for English; only the
  `[locale]` twin composes `pageSocialMetadata`.
- Breadcrumb + page chrome come from `RESOURCE_COPY[locale]`; `<RoadmapPage
  locale={locale} />` localizes heading/status labels/CTA (incl. the
  `localePath` `/feedback` link on the localized twin).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `RESOURCE_COPY` breadcrumb/page props; mirror corrected — this route inherits layout OG, never used `pageSocialMetadata` | Devin |
| 2026-10-10 | Created public `/roadmap` route | Devin |
