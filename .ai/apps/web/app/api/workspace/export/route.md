# apps/web/app/api/workspace/export/route.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`GET /api/workspace/export` — downloads `buildWorkspaceExport` output as
a JSON attachment for the caller's active workspace. Owner/admin only.

## What It Does

- `getAuthSession` → `401` when absent.
- `resolveActiveWorkspaceIdForSessionUser(session.user.id)` + membership
  `role` select on `(workspaceId, userId)` → `403` when no workspace
  resolves, the caller is not a member, or
  `canManageWorkspaceMembers(normalizeWorkspaceRole(role))` rejects
  (member/guest) — the same membership-verified gate the usage-limit
  actions use.
- `rateLimitResponse(headers, exportDownloadLimiter, "workspace-export")`
  — the shared `export-download` limiter (10/min per trusted client IP,
  fail-open) bounds the heavy read; a `429` short-circuits before the
  build and audit write.
- `recordAuditEvent` with `AUDIT_ACTIONS.workspaceDataExported`
  (`workspace.data_exported`), `targetType: "workspace"`.
- Response: `content-type: application/json; charset=utf-8`,
  `cache-control: no-store`,
  `content-disposition: attachment; filename="workspace-export-<slug>-<yyyy-mm-dd>.json"`
  (slug sanitized to `[a-zA-Z0-9_-]`).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Workspace data export download route (WP8) | Devin |
