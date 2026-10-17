# packages/agents/src/execution.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`executeToolCall` — the single execution path every adapter routes tool calls
through: scope check (defense in depth on top of `registry.forScopes`), zod
input validation, call recording (`RecordedToolCall`), then `tool.execute`
with the injected `ToolContext`. `ToolScopeDeniedError` on scope mismatch.

## Important Notes / NEVER Change

- Adapters must never call `tool.execute` directly — bypassing this wrapper
  skips scope enforcement and call recording.
- The MCP server also uses this wrapper for `tools/call`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created shared wrapper | Devin |
