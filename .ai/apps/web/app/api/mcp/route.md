# apps/web/app/api/mcp/route.ts

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

`POST /api/mcp` — stateless Streamable HTTP MCP endpoint. Awaits the shared
`apiV1Limiter` (`rate-limit-route.ts`, prefix `api-v1` — async since Task 4),
then delegates to `handleMcpRequest` with `resolveApiKeyCaller`, the
workspace-tool registry (`createWorkspaceTools({ bff: apiV1Bff, headers })`),
and the package version. GET/DELETE → 405. `runtime = "nodejs"`,
`dynamic = "force-dynamic"`.

## Important Notes / NEVER Change

- API keys only — no cookie sessions; unauthorized → 401 +
  `WWW-Authenticate: Bearer` (handled in `src/mcp-server.ts`).
- Proxy (`apps/web/proxy.ts`) matches this path but only adds a locale header
  + cookie — harmless for non-browser MCP clients; no exemption needed.
- `robots.ts` already disallows `/api/`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-23 | Created | Devin |
