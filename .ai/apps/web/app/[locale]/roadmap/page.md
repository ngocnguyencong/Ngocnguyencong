# apps/web/app/[locale]/roadmap/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Localized `/[locale]/roadmap` route: validates `isAppLocale` params,
`notFound()` on unsupported locales, redirects `en` to the unprefixed
route, and renders `<RoadmapPage locale={locale}>` inside
`ResourceShell locale={locale}` with localized metadata/canonical +
`BreadcrumbList` JSON-LD.

## Important Notes

- `generateMetadata` returns `{}` for unsupported locales; otherwise
  localized `title`/`description` from `RESOURCE_COPY[locale].roadmap`,
  canonical `/${locale}/roadmap`, `alternates.languages` + `x-default` via
  `pageLanguageAlternates("/roadmap")`, and `pageSocialMetadata` (siteName
  from `getRequestBrand()`, `locale` → og:locale, `images: [rootOgImage]`).
- Breadcrumb trail localizes via `RESOURCE_COPY[locale]` (`home` +
  `roadmap.title`), paths via `localePath`.
- Page chrome (h1, intro, status labels, CTA) localizes through the
  component's `locale` prop — the `/feedback` link becomes
  `/[locale]/feedback`; item text stays English by deliberate scope.
- `<html lang>` syncs via `LocaleHtmlLang` mounted inside `ResourceShell`.
- No `generateStaticParams` — the route is `force-dynamic` (canonical/OG/
  JSON-LD URLs resolve runtime `APP_URL` via `siteOrigin()`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Localized metadata/chrome via `RESOURCE_COPY`, `pageSocialMetadata` + `rootOgImage`, `LocaleHtmlLang` via shell; dropped the false `generateStaticParams` claim | Devin |
| 2026-10-10 | Created localized `/roadmap` route | Devin |
