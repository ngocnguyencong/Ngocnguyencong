# apps/web/src/marketing/api-reference-page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server component rendering `/api-reference` content inside the marketing
shell: utility-page hero, a beginner-readable auth explainer (session vs
`sk_` Bearer keys, read/write scopes), tag-grouped endpoint sections, and
a link to the machine-readable document at `/api/v1/openapi`. Takes
`groups` (precomputed by the route) + `locale: AppLocale` (default `"en"`);
chrome copy comes from `RESOURCE_COPY[locale].apiReference`.

## Important Notes

- Localized chrome only: h1, intro (`{openApiLink}`/`{docsLink}` template
  placeholders become anchors), the `authHeading`/`authBody` (`{bearerKey}`
  becomes the inline `<code>`), and `accessLabels[endpoint.auth]`. Endpoint
  method/path/summary mirror the English OpenAPI document verbatim.
- `endpoint.auth` is an `ApiReferenceAccess` kind (`"session-or-key"` |
  `"public"`) — the page maps kinds to localized labels.
- `anchorFor` dedupes: distinct tags can slug to the same id
  ("AI tasks"/"AI-tasks") and get `-2`/`-3` suffixes; the used-set is seeded
  with `api-auth` so the fixed auth section anchor can't collide.
- Deep-link anchors + `aria-labelledby` live on `<section>` so `.home
  section[id]` scroll-margin clears the fixed header; headings carry
  `…-heading` ids.
- No client JS; `.endpointHead` wraps so narrow viewports stay readable.
- `apiReferencePageMeta` derives its English strings from
  `RESOURCE_COPY.en.apiReference`.
- Route wiring (metadata, breadcrumbs, `force-dynamic`) lives in
  `app/api-reference/page.tsx` + `app/[locale]/api-reference/page.tsx`.
  The interactive Scalar UI remains at `/api/docs`; this page is the
  indexable, linkable counterpart.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `locale` prop + `RESOURCE_COPY` chrome, deduped section anchors, section-level ids | Devin |
| 2026-10-10 | Created for the public `/api-reference` route | Devin |
