# apps/web/src/supadata/mcp-tools.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`createSupadataTools()` — 17 ToolDefinitions registered alongside createWorkspaceTools at /api/mcp: list_sites, analytics_overview/timeseries/breakdown/realtime/insights, list/get visitors, list+record payments, goals, funnels (+results), alerts, mentions, keywords, integrations. Site resolution is workspace-scoped via injected ToolContext; record_payment is the only write-scope tool.

## Important Notes / NEVER Change

- Every execute() resolves the site inside context.workspaceId — model input can never cross workspaces.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
