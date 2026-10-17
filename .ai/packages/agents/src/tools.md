# packages/agents/src/tools.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Shared, framework-neutral tool contract: `ToolScope` (`read|write`),
`ToolContext` (server-injected `workspaceId`/`userId`/`scopes`),
`ToolDefinition` (name/title/description/scope/zod inputSchema/execute),
`defineTool` (validates snake_case name `^[a-z][a-z0-9_]{1,63}$`, freezes),
`createToolRegistry` (dup-name rejection, `list`, `forScopes`, `get`).

## Important Notes / NEVER Change

- `ToolContext` is injected by the server — model input can never set
  `workspaceId`/`userId`. Both agents and `/api/mcp` share this contract.
- No framework imports here; the contract must stay SDK-free.
- Scopes mirror the `sk_` API-key scopes (`read`/`write`) so MCP and REST
  enforce the same boundary.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created with registry + scope filtering | Devin |
