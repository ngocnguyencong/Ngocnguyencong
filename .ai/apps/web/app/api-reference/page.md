# apps/web/app/api-reference/page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

English `/api-reference` route: `force-dynamic` `metadata` export (title,
~150-char description, canonical, `pageLanguageAlternates` hreflang), a
`BreadcrumbList` JSON-LD, and `ResourceShell` wrapping `ApiReferencePage`
with `apiReferenceGroups()`.

## Important Notes

- `apiReferenceGroups()` is computed in the route so the page reads the
  live registry output (`openApiDocument.paths`) — no duplicated endpoint
  inventory anywhere in the marketing surface.
- Reads `x-supastack-locale` via `headers()`; a non-`en` resolution
  redirects to `/{locale}/api-reference` — same convention as
  `app/docs/[[...slug]]/page.tsx`.
- `force-dynamic` because canonical/JSON-LD URLs resolve runtime
  `APP_URL`; `public-routes-dynamic.test.ts` enforces it.
- `alternates.languages` via `pageLanguageAlternates("/api-reference")`.
- This route sets NO page-level `openGraph`/`twitter` — it inherits the
  root layout's card (en_US, `rootOgImage`), correct for English; only the
  `[locale]` twin composes `pageSocialMetadata`.
- Breadcrumb + page chrome come from `RESOURCE_COPY[locale]`;
  `<ApiReferencePage locale={locale} />` localizes heading/intro/auth
  explainer/access labels.
- This is the indexable counterpart of `/api/docs` (the Scalar HTML
  endpoint); both link to each other's audience.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `RESOURCE_COPY` breadcrumb/page props; mirror corrected — this route inherits layout OG, never used `pageSocialMetadata` | Devin |
| 2026-10-10 | Created public `/api-reference` route | Devin |
