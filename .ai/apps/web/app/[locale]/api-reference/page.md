# apps/web/app/[locale]/api-reference/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Localized `/[locale]/api-reference` route: validates `isAppLocale`
params, `notFound()` on unsupported locales, redirects `en` to the
unprefixed route, and renders `<ApiReferencePage locale={locale}>` (with
`apiReferenceGroups()`) inside `ResourceShell locale={locale}` plus
localized metadata/canonical + `BreadcrumbList` JSON-LD.

## Important Notes

- `generateMetadata` returns `{}` for unsupported locales; otherwise
  localized `title`/`description` from
  `RESOURCE_COPY[locale].apiReference`, canonical
  `/${locale}/api-reference`, `alternates.languages` + `x-default` via
  `pageLanguageAlternates("/api-reference")`, and `pageSocialMetadata`
  (siteName from `getRequestBrand()`, `locale` → og:locale,
  `images: [rootOgImage]`).
- Breadcrumb trail localizes via `RESOURCE_COPY[locale]` (`home` +
  `apiReference.title`), paths via `localePath`.
- Page chrome (h1, intro, auth explainer, access labels) localizes through
  the component's `locale` prop; endpoint data (paths, methods, summaries)
  mirrors the English OpenAPI document verbatim in every locale.
- `<html lang>` syncs via `LocaleHtmlLang` mounted inside `ResourceShell`.
- No `generateStaticParams` — the route is `force-dynamic` (canonical/OG/
  JSON-LD URLs resolve runtime `APP_URL` via `siteOrigin()`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Localized metadata/chrome via `RESOURCE_COPY`, `pageSocialMetadata` + `rootOgImage`, `LocaleHtmlLang` via shell; dropped the false `generateStaticParams` claim | Devin |
| 2026-10-10 | Created localized `/api-reference` route | Devin |
