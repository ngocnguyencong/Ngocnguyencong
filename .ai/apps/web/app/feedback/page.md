# apps/web/app/feedback/page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`/feedback` route — workspace feature board. `force-dynamic` server page:
calls `listFeatureRequests()` (viewer gate inside) and renders
`WebFeatureBoardPage` with `canWrite`/`canManage`/`myVoteIds`.

## Important Notes

- `listFeatureRequests` returns `{ error }` for signed-out / no-workspace
  users; the page renders the sign-in gate state rather than crashing.
- Localized mirror at `app/[locale]/feedback/page.tsx` (`en` redirects
  here; other app locales pass `locale` through for nav links).
- Disallowed in `robots.ts` — authenticated workspace surface.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created workspace feature board route | Devin |
