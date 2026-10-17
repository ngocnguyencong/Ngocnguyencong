# src/workspaces/client.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`/api/workspaces` client: `list()` → `{activeWorkspaceId, memberships}`;
`switch(workspaceId)` → POST that persists the active-workspace
preference server-side (cookie-less mobile sessions rely on the
`userWorkspacePreference` row).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
