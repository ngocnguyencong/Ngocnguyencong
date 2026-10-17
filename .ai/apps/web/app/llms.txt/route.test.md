# apps/web/app/llms.txt/route.test.ts

> Last updated: 2026-10-07 | Protection: STANDARD

## Purpose

Pins the `/llms.txt` contract: 200 + `text/plain`, `# <brandName>` H1 and
`> <tagline>` blockquote, one absolute `/docs/<slug>` link per guide on the
stubbed `APP_URL`, every `marketingStaticPaths` entry under `## Pages`, the
`/status` + `/api/health` + `/api/v1/openapi` + `/api/mcp` reference links,
and no app-only route link targets.
The public `## Security protocols` section links only existing guide slugs and
distinguishes BFF authorization from PostgREST RLS.

## Important Notes

- `vi.mock("server-only", () => ({}))` is required — `route.ts` →
  `src/marketing/seo` (`siteOrigin`) is marked server-only; same pattern as
  `seo.test.ts`.
- `vi.stubEnv("APP_URL", …)` sets the emitted origin per test;
  `afterEach` → `vi.unstubAllEnvs()`.
- Guide-link count compares `](<origin>/docs/` occurrences in the `## Docs`
  section to `guides.length` — the `/docs` index link has no trailing slash
  and is not counted; explicit security links are counted separately.
  `guides.length > 0` is asserted first so the equality can't pass vacuously.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-07 | Added public security-section assertions and scoped the guide count to the Docs section | Codex |
| 2026-10-06 | Created — 5 cases | Devin |
