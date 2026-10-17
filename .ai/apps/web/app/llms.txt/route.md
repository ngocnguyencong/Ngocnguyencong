# apps/web/app/llms.txt/route.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

`GET /llms.txt` — serves `buildLlmsTxt(siteOrigin())` as
`text/plain; charset=utf-8`. The llmstxt.org index makes every product built
on this codebase agent-readable by default.

## Important Notes / NEVER Change

- `force-dynamic` must not be removed: every emitted link is absolute — a
  static build would bake `localhost:3000` into llms.txt (same 2026-09-24
  fix as robots.ts/sitemap.ts; pinned by
  `src/marketing/public-routes-dynamic.test.ts`).
- The proxy matcher skips dotted paths (`.*\..*`), so `/llms.txt` never gets
  locale redirects or locale cookies — verified 2026-10-06.
- Dotted folder = literal `/llms.txt` segment; the route shares the
  `force-dynamic` + per-request `siteOrigin()` contract with the
  `app/sitemap.ts` / `app/robots.ts` metadata files. The static folder
  beats the root `[locale]` dynamic segment for `/llms.txt`.
- Content body lives in `src/marketing/llms-txt.ts` (pure, unit-testable);
  keep this file a thin adapter.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Created — `GET` + `force-dynamic` | Devin |
| 2026-10-06 | `force-dynamic` note translated to English — shipped mirrors must stay English-only | Devin |
