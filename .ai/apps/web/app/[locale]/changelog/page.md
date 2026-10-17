# apps/web/app/[locale]/changelog/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Localized `/[locale]/changelog` route: validates `isAppLocale` params,
`notFound()` on unsupported locales, redirects `en` to the unprefixed
route, and renders `<ChangelogPage locale={locale}>` inside
`ResourceShell locale={locale}` with localized metadata/canonical +
`BreadcrumbList` JSON-LD.

## Important Notes

- `generateMetadata` returns `{}` for unsupported locales; otherwise
  localized `title`/`description` from `RESOURCE_COPY[locale].changelog`,
  canonical `/${locale}/changelog`, `alternates.languages` + `x-default`
  via `pageLanguageAlternates("/changelog")`, and `pageSocialMetadata`
  (siteName from `getRequestBrand()`, `url` + `locale` → og:locale/og:url,
  `images: [rootOgImage]` — page-level openGraph replaces the layout's).
- Breadcrumb trail localizes via `RESOURCE_COPY[locale]` (`home` +
  `changelog.title`), paths via `localePath`.
- Page chrome (h1, intro, badge, dates) localizes through the component's
  `locale` prop; entry titles/points stay English by deliberate scope.
- `<html lang>` syncs via `LocaleHtmlLang` mounted inside `ResourceShell`.
- No `generateStaticParams` — the route is `force-dynamic` (canonical/OG/
  JSON-LD URLs resolve runtime `APP_URL` via `siteOrigin()`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Localized metadata/chrome via `RESOURCE_COPY`, `pageSocialMetadata` + `rootOgImage`, `LocaleHtmlLang` via shell; dropped the false `generateStaticParams` claim | Devin |
| 2026-10-10 | Created localized `/changelog` route | Devin |
