# apps/web/src/marketing/public-pages.test.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

SSR smoke + locale-route tests for the `/changelog`, `/roadmap`, and
`/api-reference` marketing pages: `renderToStaticMarkup` coverage of each
server component (English + localized chrome), deep-link anchor shape and
dedupe, unprefixed-route locale redirects, and `[locale]/…` route behavior —
non-English locales render inside `ResourceShell`, `en` redirects to the
unprefixed route, unsupported locales `notFound()`/`generateMetadata → {}`.

## Important Notes

- Mocks `server-only`, `next/font/local`, and `next/headers` (fixed
  `x-supastack-locale: de`) so `seo.tsx`/`ResourceShell`/
  `custom-domains/runtime` imports load outside a request context and the
  unprefixed routes exercise the redirect branch.
- Asserts on returned element props for the shell (`tree.props.locale`)
  and on thrown `NEXT_REDIRECT`/`NEXT_NOT_FOUND` markers — mirrors how
  Next's `redirect`/`notFound` surface in vitest. Redirect *destinations*
  are read off the error `digest` (`…;/de/changelog;307;`).
- Localized render cases pin the deliberate scope: German
  h1/badge/status/access labels + `/de/feedback` link while entry/item and
  endpoint bodies stay English.
- `generateMetadata` cases assert `{}` on unsupported locales and the
  localized title + `de_DE` og locale + `[rootOgImage]` card on `de`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Localized-chrome renders, section-anchor + dedupe, unprefixed locale redirect destinations, `generateMetadata` `{}`/social cases | Devin |
| 2026-10-10 | Created for the three public marketing pages | Devin |
