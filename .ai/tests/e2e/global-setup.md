# tests/e2e/global-setup.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Playwright `globalSetup` that pre-compiles every route family the local
suite touches before `fullyParallel` workers start — plus the reusable
`warmRoutes(config, paths)` helper exported for the e2e-production
suite's own warm-up.

## What It Does

Launches chromium (honoring the project's `channel`, e.g. system Chrome on
Windows) against the resolved `baseURL`, then sequentially `page.goto`s
`WARM_PATHS` (21 entries: `/`, `/auth`, `/api/auth/get-session`,
`/settings`, `/settings/appearance`, `/docs`, `/dashboard`, `/ai`,
`/api/local-reference/hydrate`, `/blog`, one blog slug, `/faq`, `/contact`,
`/privacy`, `/terms`, `/legal/license`, `/legal/acceptable-use`,
`/legal/disclaimer`, `/showcase`, `/sitemap.xml`, `/robots.txt`) with a
120s per-path cap + 10s `networkidle` settle so post-load API calls
compile too. Dynamic routes only need one representative path — a
`[...slug]`/`[action]` family compiles once, but each static page module
(`/legal/*`, `/settings` → general) needs its own entry.

`warmRoutes(config, paths, { sitemap })` is the exported core; the default
export runs it over `WARM_PATHS`. After the explicit paths warm (including
`/sitemap.xml`), `listSitemapPaths(baseURL)` fetches the sitemap and warms
every distinct module it advertises. `selectWarmPaths` groups documentation
slugs by their shared catch-all module, preserving a representative for each
locale and every unrelated public path. It skips paths/families already warmed
explicitly. Visiting all 665 URLs exhausted the Next dev heap and timed out
during a server restart; warm shared modules once while keeping all navigation
assertions. Suites that never navigate public routes pass `{ sitemap: false }`.

## Agent Decisions / Thoughts

- 2026-10-11: Warm API routes with the request context. Browser navigation can
  reject an intentional bodyless 405 even though the handler compiled correctly.
  Page routes still use a real browser for client compilation and hydration.

- **2026-09-22:** A real browser (not `request.get`) is used so client
  chunks and hydration-time API calls are warmed, not just SSR. Sequential
  order keeps the dev server compiling one route at a time.
- **2026-09-28:** The list must cover every *distinct* page module a test
  can navigate to — cold misses are the flake source (CI failures on
  `/legal/license` and `/settings` → general traced to missing entries).
  The production suite uses `next dev` too, so `tests/e2e-production/
  global-setup.ts` reuses `warmRoutes` with its own smaller path list.
- **2026-09-28:** Fixed lists still missed routes — docs-guide client
  navigations flaked next. `warmRoutes` now expands via the app's own
  sitemap so coverage tracks new routes automatically.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | WARM_PATHS += `/ai` — the AI-task console moved off `/dashboard`; the analytics route stays warmed | Devin |
| 2026-09-22 | Created: route warm-up for cold `.next` parallel runs | Devin |
| 2026-09-28 | `warmRoutes` exported for the e2e-production suite; WARM_PATHS += `/settings`, `/legal/{license,acceptable-use,disclaimer}` (CI cold-compile flake fixes) | Devin |
| 2026-09-28 | `warmRoutes` gains `sitemap` expansion — warms every route the app's `/sitemap.xml` advertises so client-side navigations can't cold-compile mid-test | Devin |
