# apps/web/src/marketing/llms-txt.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

`buildLlmsTxt(origin)` renders the llmstxt.org-format body served at
`GET /llms.txt` (`app/llms.txt/route.ts`). H1 is `siteConfig.brandName`,
the blockquote is `siteConfig.tagline`, then `## Docs` (guides grouped by
`groupGuides()`/`DOC_GROUPS`), `## Pages` (`marketingStaticPaths` +
`STATIC_PAGE_INFO`), `## Blog` (posts), `## Security protocols` (links to
existing public guides), and `## Reference` (public endpoints). Every link is
absolute against the passed `origin` and uses the
default locale's unprefixed canonical shape via `localePath(DEFAULT_LOCALE, …)`.

## Important Notes

- Pure module — never import `server-only`/`next/headers` here; the vitest
  suite imports it directly. `origin` is an argument for the same reason
  `buildMarketingSitemapEntries` takes no env (the route resolves
  `siteOrigin()`).
- `STATIC_PAGE_INFO` is `Record<marketingStaticPaths[number], …>` — adding a
  public path without a label/description fails typecheck, same contract as
  `STATIC_ENTRY_META`. `/`'s description reads the dictionary's
  `marketingLanding.metadataDescription` so rebrands flow through.
- `REFERENCE_LINKS` must only list routes that exist (`/status`,
  `/api/health`, `/api/v1/openapi`, `/api/mcp` today); products edit this
  list to match their own public surface. Never link app UI routes — the
  test bans `/dashboard`, `/settings`, `/admin`, `/chat`, `/billing`,
  `/auth` as link targets; Bearer-gated machine endpoints are allowed when
  their auth contract is disclosed in the description.
- `inline()` strips `[]` and collapses whitespace so content strings can't
  break the `- [label](url): description` link grammar — it wraps every
  emitted label/description, `REFERENCE_LINKS` included.
- `## Security protocols` follows Blog and links only existing guide slugs
  from `apps/web/src/resources/content.ts`: auth, API routes, database,
  Supabase, and observability. Keep RLS scoped to PostgREST exposure and
  distinct from Better Auth/BFF checks; never link the repo-only
  `docs/agent-security.md` from this public route.
- Copy stays neutral per the demo-content boundary — no product claims,
  counts, or testimonials.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `STATIC_PAGE_INFO` += Changelog, Roadmap, API reference entries so `/llms.txt` Pages lists all three new routes | Devin |
| 2026-10-07 | Added a public Security protocols section linked to existing auth, API, database, Supabase and observability guides | Codex |
| 2026-10-06 | Created — llms.txt body builder (Docs/Pages/Blog/Reference) | Devin |
| 2026-10-06 | Footer self-reference fixed to repo-relative `apps/web/app/llms.txt/route.ts` | Devin |
