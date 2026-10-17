# apps/web/src/supadata/auth.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Two auth contexts: `sd_*` site keys (hashed, revocable, `resolveSiteByKey`) pin a site; `sk_*` workspace keys or cookie session resolve the workspace (`resolveCallerWorkspace`). `resolveApiContext`/`resolveRequestSite` combine them for /api/v1; `listWorkspaceSites` feeds the dashboard picker.

## Important Notes / NEVER Change

- `siteForWorkspace` enforces workspaceId scoping on every read.
- Site-key lookups touch lastUsedAt.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
