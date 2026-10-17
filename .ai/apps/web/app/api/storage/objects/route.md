# apps/web/app/api/storage/objects/route.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`GET /api/storage/objects` — session-authenticated download for
workspace-scoped objects (avatars, logos, uploaded files) stored under the
`workspaceId/` key prefix. `runtime = "nodejs"`.

## What It Does

- `getAuthSession(request.headers)` → `401 { error: "Unauthorized" }` when
  signed out.
- Requires `workspaceId` + `key` query params → `400` when either is
  absent.
- `assertWorkspaceObjectKey` enforces the `workspaceId/` prefix and rejects
  `..` traversal → `400 { error: "Invalid object key" }`.
- Looks up the caller's `workspace_membership` row for `(workspaceId,
  session.user.id)` → `403 { error: "Forbidden" }` when absent. Any role
  authorizes the read — these are workspace assets all members may view.
- `createServerObjectStorage().getObject` → `404 { error: "Not found" }`
  when missing; otherwise `200` with the object body, its `content-type`,
  `cache-control: private, max-age=60`, and
  `x-content-type-options: nosniff`.

## Public API

`GET /api/storage/objects?workspaceId=<id>&key=<workspaceId/...>` → binary
body (`200`) or `{ error }` JSON (`400`/`401`/`403`/`404`).

## Dependencies

`../../../../src/auth-runtime` (`database`, `getAuthSession`),
`../../../../src/storage-runtime` (`createServerObjectStorage`),
`@supastack/db` (`workspaceMembership`), `@supastack/storage`
(`assertWorkspaceObjectKey`), `drizzle-orm` (`and`, `eq`), `next/server`.

## Agent Decisions

- Membership check sits after session/param/key validation and before the
  storage lookup — cheapest checks first, and no storage call is made for
  non-members.
- Membership presence alone authorizes (viewer included); the `where`
  clause mirrors `src/workspace-access.ts` so both paths resolve
  membership identically.

## Important Notes

- The prefix assertion alone does NOT bind `workspaceId` to the caller —
  the membership row does. Do not drop it when refactoring; the test file
  source-pins both `eq(...)` predicates.
- `x-content-type-options: nosniff` rides the 200 because member-uploaded
  bytes are served back to browsers — a stored HTML/SVG upload must not be
  re-interpreted as active content.

## Bug Fixes

| Date | Fix | Author |
| --- | --- | --- |
| 2026-09-27 | IDOR: authenticated sessions could read any workspace's objects by guessing `workspaceId` + `key`; added the `workspace_membership` lookup → `403` | Devin |

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Added `x-content-type-options: nosniff` to the 200 response; tests now pin the `(workspaceId, user.id)` membership predicate, `.limit(1)`, and key-validation-before-membership ordering | Devin |
| 2026-09-27 | Require workspace membership for object downloads (IDOR fix) | Devin |
