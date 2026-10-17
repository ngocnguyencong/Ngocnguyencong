# apps/web/src/marketing/seo.tsx

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Single SEO boundary for the public surface. Exports the canonical site origin,
absolute-URL helper, the `<JsonLd>` injector, schema.org JSON-LD builders
(Organization, WebSite, FAQPage, BlogPosting, BreadcrumbList incl. docs/blog
trails), `pageLanguageAlternates(path)`/`homeLanguageAlternates()` (hreflang
maps incl. `x-default` — the former for any localized public path, the latter
the `/` shorthand), `ogLocaleFor()`, and `pageSocialMetadata()` — the ONLY
sanctioned way to set
`openGraph`/`twitter` outside the root layout. Server-only — every consumer is
a server component or route
handler (`layout.tsx`, `sitemap.ts`, `robots.ts`, `app/page.tsx`,
`app/[locale]/page.tsx`, `faq/page.tsx`, `src/landing-page.tsx`,
`src/resources/resource-pages.tsx`).

## Important Notes

- `siteOrigin()` = `APP_URL` env → `http://localhost:3000`; it is the one source
  for `metadataBase`, sitemap URLs, robots sitemap URL, and JSON-LD ids. Do not
  re-implement `process.env.APP_URL` lookups elsewhere.
- `jsonLdScript()` escapes `<` → `\u003c`; always inject schema through
  `<JsonLd>` so user/content strings cannot break out of the `<script>` tag.
- Schema renders where the content appears: Organization+WebSite in the root
  layout body, FAQPage in `LandingPage` + `faq/page.tsx` (both render
  `siteConfig.faq`), BlogPosting+BreadcrumbList inside `BlogArticle`,
  BreadcrumbList inside `DocsPage` only when `results === undefined` (never on
  search-results pages).
- Title contract: root `title.template` = `"%s | supastack"` → pages set bare
  titles; `title.absolute` only on the localized homepage which already carries
  the brand. Canonicals are per page (`alternates.canonical`), never global.
- **og/twitter contract**: Next merges metadata per top-level key — a page's
  own `openGraph`/`twitter` object REPLACES the layout's wholesale (drops
  siteName/type/locale/images). Pages compose via `pageSocialMetadata()`
  (siteName param = `brand.name` from `getRequestBrand()`). The
  `opengraph-image` file convention injects a card only for segments that
  OWN a convention file (blog/[slug] → per-post card); a page that defines
  `openGraph` in a segment without one (e.g. `[locale]`) emits NO og:image
  unless it passes `images` — use `images: [rootOgImage]` (exported const:
  `/demo-social.png` 1200×630). The helper also places explicit images in `twitter`
  when provided. `social-metadata.test.ts` greps all
  page/layout files for bare `openGraph: {`/`twitter: {` outside the root
  layout.
- Tests in `seo.test.ts` (`vi.mock("server-only")` pattern). Covered by
  AGENTS.md → ## SEO.

## Open Threads / Resume Context

- Docs breadcrumbs accept a locale and qualify their home/documentation URLs and labels to match the localized guide and canonical.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `pageLanguageAlternates(path)` extracted so non-home public pages (`/changelog`, `/roadmap`, `/api-reference`) emit correct per-path hreflang maps; `homeLanguageAlternates()` delegates with `"/"` | Devin |
| 2026-09-27 | Shared card descriptor now points at static `/demo-social.png`; page composer emits explicit Twitter images when supplied | Codex |
| 2026-09-24 | `pageSocialMetadata()` + `rootOgImage` — shared og/twitter composer fixing page overrides wiping siteName/type/locale; `images` option for segments without their own convention file (verified: /de emitted no og:image) | Devin |
| 2026-09-21 | Initial SEO module: origin/URL helpers, JsonLd injector + schema builders, hreflang + OG-locale helpers | Devin |
