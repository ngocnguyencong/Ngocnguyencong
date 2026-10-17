# apps/web/src/mcp-server.test.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Offline tests (9) driving real JSON-RPC `Request`s through `handleMcpRequest`
with a fake registry + caller resolver: 401 + Bearer challenge for
missing/invalid keys; no cookie-session fallback; initialize → serverInfo
`supastack`; `tools/list` scope filtering (read-only vs read+write);
`tools/call` JSON text content with injected `ToolContext`;
`WorkspaceToolError` → `isError` with safe message; unregistered/out-of-scope
call rejected; GET/DELETE → 405.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
