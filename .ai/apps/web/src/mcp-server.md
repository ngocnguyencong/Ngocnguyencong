# apps/web/src/mcp-server.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`handleMcpRequest(request, deps)` — stateless Streamable HTTP MCP endpoint
logic on `@modelcontextprotocol/sdk` (`McpServer` +
`WebStandardStreamableHTTPServerTransport` with `enableJsonResponse: true` and
no `sessionIdGenerator`, so no session state). Fresh server+transport per
request.

Auth: `resolveCaller` (production binding `resolveApiKeyCaller`) — `null` or
`"invalid"` → JSON 401 + `WWW-Authenticate: Bearer`. Cookie sessions never
apply. Non-POST → 405.

Tools: `registry.forScopes(caller.scopes)` → `registerTool` with the tool's
zod object schema; callbacks run through `executeToolCall` (zod parse, scope
enforcement, injected `ToolContext`); results are JSON text content;
`WorkspaceToolError` → `isError: true` with the safe REST message.

## Important Notes / NEVER Change

- Route `app/api/mcp/route.ts` applies the shared `apiV1Limiter`
  (`rate-limit-route.ts`) before delegating here and exports
  `runtime = "nodejs"` + `dynamic = "force-dynamic"`.
- Server name is `"supastack"`, version from `apps/web/package.json`.
- `sessionIdGenerator` is omitted entirely (not `undefined`) because
  `exactOptionalPropertyTypes` rejects explicit undefined; omitting is what
  disables sessions.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created; 9 offline tests drive real JSON-RPC Requests | Devin |
