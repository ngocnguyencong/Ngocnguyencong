# apps/web/src/marketing/roadmap-page.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Server component rendering `/roadmap` content inside the marketing shell:
utility-page hero, items grouped by `groupRoadmapItems` into status
sections with localized labels, and a closing CTA pointing signed-in users
to the in-app feature board. Takes a `locale: AppLocale` prop (default
`"en"`); chrome copy comes from `RESOURCE_COPY[locale].roadmap`.

## Important Notes

- Localized chrome only: h1, intro, status labels (`statusLabels[group.status]`),
  and the CTA (`cta` template split on `{featureBoard}`). Item
  titles/descriptions stay English by deliberate scope — curated data.
- The CTA link is `localePath(locale, "/feedback")` so localized routes keep
  the locale prefix on the private board link.
- Deep-link anchors + `aria-labelledby` live on `<section>` (not the h2) so
  `.home section[id]` scroll-margin clears the fixed header; headings carry
  their own `…-heading` ids.
- Reads `roadmapItems` only — no `feature_request` queries; the private
  board stays private and this page stays static.
- `.status[data-status]` colors come from `roadmap.module.css`
  (`--success` for shipped, `--info` for in_progress, muted for planned).
- `roadmapPageMeta` derives its English strings from `RESOURCE_COPY.en.roadmap`.
- Route wiring (metadata, breadcrumbs, `force-dynamic`) lives in
  `app/roadmap/page.tsx` + `app/[locale]/roadmap/page.tsx`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `locale` prop + `RESOURCE_COPY` chrome, localized `/feedback` href, section-level anchors | Devin |
| 2026-10-10 | Created for the public `/roadmap` route | Devin |
