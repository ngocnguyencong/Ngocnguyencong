# app/ai/page.tsx

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Canonical English route for the durable AI-task console (`/ai`). `force-dynamic`;
resolves `getReferenceMode(parseServerConfig())` — local mode renders
`ReferenceApp` (deterministic in-memory demo), production mode renders
`ProductionReferenceApp` with request-origin `githubApiUrl`,
`githubCallbackURL` = `${origin}/ai`, server-side `getGithubConnection`,
and `getRequestBrand()`. Shared task-recovery links (`?taskId`,
`?submissionKey`) reach it via redirects from `/` and `/[locale]/dashboard`;
`/ai` is disallowed in `robots.ts` like every other app surface.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | Replaced the `/chat` redirect with the real console mount; `/dashboard` stays the analytics product | Devin |
