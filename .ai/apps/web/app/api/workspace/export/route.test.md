# apps/web/app/api/workspace/export/route.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Route test for `GET /api/workspace/export` — mocks `next/headers`,
`auth-runtime` (session + membership select chain),
`organization-actions` workspace resolution, `audit-runtime`,
`rate-limit-route`, `rate-limit-runtime`, and `workspace-export`
following the `app/api/storage/objects/route.test.ts` pattern.

## What It Covers

- `401` unauthenticated; `403` for missing active workspace, missing
  membership, member, guest, and unknown roles.
- `200` for owner and admin — `buildWorkspaceExport` called with the
  resolved workspace id, JSON content type, `no-store`, and a
  `workspace-export-<slug>-<yyyy-mm-dd>.json` attachment filename.
- Audit event `workspace.data_exported` recorded with the workspace as
  target; limiter rejection short-circuits before build + audit.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Route test created with the export route (WP8) | Devin |
