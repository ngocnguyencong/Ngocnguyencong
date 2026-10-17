# apps/web/src/developers-settings.tsx

> Last updated: 2026-10-02 | Protection: STANDARD

## Purpose

Settings → Developers surface: `sk_` API keys (create/list/revoke),
webhooks, and workspace Cron schedules (`job_schedule` rows).

## Important Notes / NEVER Change

- Copy states keys authorize both `/api/v1` REST and the `/api/mcp` MCP
  server — the same `sk_` credentials and `read`/`write` scopes govern both.
- The Cron schedules quiet-note shows `· missed N` only when a
  schedule's cumulative `missedRuns` > 0 — occurrences skipped while no
  tick ran (e.g. a sleeping laptop hosting the app).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-02 | Schedule row quiet-note += conditional `· missed N` (cumulative `missedRuns`) | Devin |
| 2026-09-23 | API-keys copy mentions `/api/mcp` | Devin |
