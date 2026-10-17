# apps/web/app/changelog/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

English `/changelog` route: `force-dynamic` `metadata` export (title,
~150-char description, canonical, `pageLanguageAlternates` hreflang), a
`BreadcrumbList` JSON-LD, and `ResourceShell` wrapping `ChangelogPage`.

## Important Notes

- Reads `x-supastack-locale` (set by `proxy.ts` from path → cookie →
  accept-language) via `headers()`; a non-`en` resolution redirects to the
  `/{locale}/changelog` route — the same convention as
  `app/docs/[[...slug]]/page.tsx`.
- `force-dynamic` is required because canonical/JSON-LD URLs resolve
  runtime `APP_URL` through `siteOrigin()`; `public-routes-dynamic.test.ts`
  enforces it for every `marketingStaticPaths` entry.
- `alternates.languages` comes from `pageLanguageAlternates(path)` — the
  helper takes the localized path, not just the homepage.
- This route sets NO page-level `openGraph`/`twitter` — it inherits the
  root layout's card (en_US, `rootOgImage`, autofilled title/description),
  which is correct for English. Only the `[locale]` twin composes
  `pageSocialMetadata` (needed for `og:locale`/`og:url` overrides).
- Breadcrumb + page chrome come from `RESOURCE_COPY[locale]` ( `"en"` after
  the redirect guard ); `<ChangelogPage locale={locale} />` localizes
  heading/badge/dates.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `RESOURCE_COPY` breadcrumb/page props; mirror corrected — this route inherits layout OG, never used `pageSocialMetadata` | Devin |
| 2026-10-10 | Created public `/changelog` route | Devin |
