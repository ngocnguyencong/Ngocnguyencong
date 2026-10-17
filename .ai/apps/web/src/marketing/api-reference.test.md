# apps/web/src/marketing/api-reference.test.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Guard tests for `api-reference.ts`: every rendered row originates from
`openApiDocument` (no hand-maintained inventory — the test diffs the
transform output against the document's own paths/operations), grouping
by tag, method/path/summary fields, and the auth-classification heuristic.

## Important Notes

- Imports `@supastack/api` for the document — the test fails if the
  registry changes and the transform stops mirroring it, which is the
  intended drift alarm.
- `endpoint.auth` asserts the `ApiReferenceAccess` kinds
  (`"session-or-key"`/`"public"`) — display labels live in `RESOURCE_COPY`
  and are asserted in `public-pages.test.tsx` instead.
- The doc fixture widens `SupastackOpenApiPathItem` the same way the page
  does; the nullish-guard case feeds `null` path items, `{ get: undefined }`
  members, and non-operation keys (`parameters`).
- `vi.mock("server-only")` is not needed here (the transform module is
  dependency-light); keep it that way.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Auth kind vocabulary + nullish operation guard cases | Devin |
| 2026-10-10 | Created alongside `/api-reference` page | Devin |
