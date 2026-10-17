# apps/web/src/workspace-tools.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Shared workspace-tool definitions (`createWorkspaceTools({bff, headers})`)
used by agent runners, `/api/mcp`, and the budgeted `runBudgetedAgent` path
(callers pass the array into `runAgent`; it is filtered to `input.scopes`).
Each tool calls `apiV1Bff` with the caller's headers so REST
auth/scope/workspace checks are identical — the tool layer never widens
access.

Tools: `get_workspace` (read), `list_entitlements` (read), `create_ai_task`
(write; `alias fast|smart|cheap`, `prompt`, optional `requirements`),
`get_ai_task` (read; `taskId`), `get_ai_task_result` (read; `taskId`).
Non-2xx BFF responses throw `WorkspaceToolError(code, message)`.

## Important Notes / NEVER Change

- `create_ai_task` builds its BFF body with `context.workspaceId` — the model
  can never pick a workspace.
- BFF `parseCreateBody` requires a `requirements` object; the tool sends `{}`
  when the model omits it.
- `WorkspaceToolError` messages are safe REST error strings — the MCP layer
  surfaces them as `isError` results.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Tool set now also feeds `runBudgetedAgent` (scope-filtered) via `getAgentRunRuntime().runAgent` | Devin |
| 2026-09-23 | Created (pure, dep-injected, 6 fake-BFF tests) | Devin |
