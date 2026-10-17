# apps/web/src/workspace-tools.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Fake-BFF tests (7): tool names/scopes; caller headers passed through;
`create_ai_task` uses `context.workspaceId`; empty `requirements` default;
task/result reads by id; non-2xx → `WorkspaceToolError` with code+message,
incl. a BFF 429 → `rateLimited`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | +BFF 429 `create_ai_task` → `rateLimited` `WorkspaceToolError` | Devin |
| 2026-09-23 | Created | Devin |
