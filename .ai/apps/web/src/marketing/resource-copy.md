# apps/web/src/marketing/resource-copy.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Localized chrome copy for the public resource pages (`/changelog`,
`/roadmap`, `/api-reference`): `RESOURCE_COPY: Record<AppLocale, ResourceCopy>`
covers en/de/es/fr titles, descriptions, intros, badge/status/access labels,
the roadmap CTA, and the "Home" breadcrumb — the same `Record<AppLocale, …>`
convention as `DOCS_COPY` in `src/resources/docs-copy.ts`.

## Important Notes

- Deliberate scope: only page chrome localizes. Changelog entry
  titles/points, roadmap item text, and API endpoint rows are curated English
  data — they never route through this map (noted in code comments).
- Sentences carrying inline links or code use `{placeholder}` templates
  (`{featureBoard}`, `{openApiLink}`, `{docsLink}`, `{bearerKey}`) split at
  render time — same pattern as `setupSentence` in the docs pages.
- `accessLabels` is keyed by `ApiReferenceAccess` (`"session-or-key"` /
  `"public"`) — `api-reference.ts` emits kinds, the page renders labels.
- `statusLabels` is keyed by `RoadmapStatus`; the canonical English labels
  stay exported as `ROADMAP_STATUS_LABELS` in `roadmap-items.ts`.
- `changelogPageMeta`/`roadmapPageMeta`/`apiReferencePageMeta` derive their
  English title/description from `RESOURCE_COPY.en`, so metadata, h1, and
  breadcrumbs share one copy source; the `[locale]` routes read the same keys
  through `RESOURCE_COPY[locale]`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Created: en/de/es/fr chrome copy for the three resource pages | Devin |
